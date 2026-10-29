const { FAKE_CODEFORCES } = require("./config");

const API_URL = "https://codeforces.com/api";
const MIN_GAP_MS = 2000;
const REQUEST_TIMEOUT_MS = 10000;
const STATUS_CACHE_MS = 5000;

let lastRequestTime = 0;
let queue = Promise.resolve();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// codeforces allows about 1 request every 2 seconds, so requests wait their turn
function waitForTurn() {
    const myTurn = queue.then(async () => {
        const waitTime = lastRequestTime + MIN_GAP_MS - Date.now();
        if (waitTime > 0) {
            await sleep(waitTime);
        }
        lastRequestTime = Date.now();
    });

    queue = myTurn;
    return myTurn;
}

async function callApi(method, params) {
    await waitForTurn();

    const url = `${API_URL}/${method}?${new URLSearchParams(params)}`;
    const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    const data = await response.json();

    if (data.status !== "OK") {
        throw new Error(data.comment || "Codeforces API error");
    }

    return data.result;
}

async function getUserInfo(handle) {
    try {
        const users = await callApi("user.info", { handles: handle });
        return users[0];
    } catch (error) {
        if (error.message.includes("not found")) {
            return null;
        }
        throw error;
    }
}

const statusCache = new Map();

async function getRecentSubmissions(handle) {
    const key = handle.toLowerCase();
    const cached = statusCache.get(key);

    if (cached && Date.now() - cached.time < STATUS_CACHE_MS) {
        return cached.submissions;
    }

    const submissions = await callApi("user.status", {
        handle,
        from: 1,
        count: 50
    });

    if (statusCache.size > 500) {
        statusCache.clear();
    }
    statusCache.set(key, { time: Date.now(), submissions });

    return submissions;
}

async function getLastSubmissions(handle, count = 10) {
    return callApi("user.status", { handle, from: 1, count });
}

module.exports = {
    getUserInfo,
    getRecentSubmissions,
    getLastSubmissions
};

if (FAKE_CODEFORCES) {
    console.log("Using FAKE codeforces api (FAKE_CODEFORCES=true)");

    module.exports = {
        getUserInfo: async (handle) => ({ handle, rating: 1500 }),
        getRecentSubmissions: async () => [],
        getLastSubmissions: async () => []
    };
}

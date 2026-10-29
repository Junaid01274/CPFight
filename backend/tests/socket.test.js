const { describe, test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");

const config = require("../src/config");
const codeforces = require("../src/codeforces");
const app = require("../src/app");
const { registerSocketHandlers } = require("../src/socketHandlers");
const { PROBLEMS } = require("./helpers");

codeforces.getUserInfo = async (handle) => {
    if (handle === "nobody") {
        return null;
    }
    return { handle, rating: 1500 };
};

let fakeSubmissions = [];
codeforces.getLastSubmissions = async () => fakeSubmissions;

config.VERIFY_HANDLES = false;
config.VERIFY_CHECK_COOLDOWN_MS = 0;

let server;
let io;
let url;
let clients = [];

before(async () => {
    server = http.createServer(app);
    io = new Server(server);
    registerSocketHandlers(io, PROBLEMS);

    await new Promise((resolve) => server.listen(0, resolve));
    url = `http://localhost:${server.address().port}`;
});

after(() => {
    io.close();
    server.close();
});

afterEach(() => {
    for (const client of clients) {
        client.disconnect();
    }
    clients = [];
});

function newClient() {
    const client = connect(url, { transports: ["websocket"], forceNew: true });
    clients.push(client);
    return client;
}

function waitFor(socket, event, check = () => true, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, listener);
            reject(new Error(`timed out waiting for ${event}`));
        }, timeoutMs);

        function listener(data) {
            if (check(data)) {
                clearTimeout(timer);
                socket.off(event, listener);
                resolve(data);
            }
        }
        socket.on(event, listener);
    });
}

function notReceived(socket, event, ms = 300) {
    return new Promise((resolve) => {
        let got = false;
        const listener = () => { got = true; };
        socket.on(event, listener);
        setTimeout(() => {
            socket.off(event, listener);
            resolve(!got);
        }, ms);
    });
}

async function createRoom(client, handle) {
    const joined = waitFor(client, "joinedRoom");
    client.emit("createRoom", { username: handle, handle });
    return joined;
}

async function joinRoom(client, roomId, handle) {
    const joined = waitFor(client, "joinedRoom");
    client.emit("joinRoom", { roomId, username: handle, handle });
    return joined;
}

async function joinTeam(client, team) {
    const state = waitFor(client, "roomState", (s) => s.myTeam === team);
    client.emit("joinTeam", team);
    return state;
}

async function setupGame() {
    const alice = newClient();
    const bob = newClient();
    const carol = newClient();

    const { roomId, token } = await createRoom(alice, "alice");
    await joinRoom(bob, roomId, "bob");
    await joinRoom(carol, roomId, "carol");

    await joinTeam(alice, "A");
    await joinTeam(bob, "A");
    await joinTeam(carol, "B");

    const started = waitFor(alice, "roomState", (s) => s.status === "running");
    alice.emit("startGame");
    const state = await started;

    return { alice, bob, carol, roomId, aliceToken: token, state };
}

describe("http", () => {
    test("GET /health", async () => {
        const response = await fetch(`${url}/health`);
        const body = await response.json();
        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.status, "ok");
    });
});

describe("socket flow", () => {
    test("create room, join, pick teams and start", async () => {
        const { state } = await setupGame();

        assert.strictEqual(state.players.length, 3);
        assert.strictEqual(state.problems.length, PROBLEMS.length);
        assert.ok(state.endsAt > state.startedAt);
    });

    test("unknown handle gets an error", async () => {
        const client = newClient();
        const error = waitFor(client, "errorMessage");
        client.emit("createRoom", { username: "x", handle: "nobody" });
        assert.strictEqual(await error, "Codeforces handle not found");
    });

    test("joining a room that doesn't exist gets an error", async () => {
        const client = newClient();
        const error = waitFor(client, "errorMessage");
        client.emit("joinRoom", { roomId: "ZZZZZ", username: "x", handle: "someone" });
        assert.strictEqual(await error, "Room does not exist");
    });

    test("code goes to teammates only", async () => {
        const { alice, bob, carol } = await setupGame();

        const bobGetsCode = waitFor(bob, "teamCodeUpdate");
        const carolGetsNothing = notReceived(carol, "teamCodeUpdate");
        alice.emit("codeUpdate", { problemId: "4A", code: "int main() {}" });

        const update = await bobGetsCode;
        assert.strictEqual(update.code, "int main() {}");
        assert.strictEqual(update.problemId, "4A");
        assert.strictEqual(await carolGetsNothing, true);
    });

    test("team chat goes to teammates only, disturb chat goes to everyone", async () => {
        const { alice, bob, carol } = await setupGame();

        const bobGetsTeamMsg = waitFor(bob, "teamMessage");
        const carolNoTeamMsg = notReceived(carol, "teamMessage");
        alice.emit("sendTeamMessage", "I'll take problem A");
        assert.strictEqual((await bobGetsTeamMsg).message, "I'll take problem A");
        assert.strictEqual(await carolNoTeamMsg, true);

        const aliceGetsDisturb = waitFor(alice, "disturbMessage");
        carol.emit("sendDisturbMessage", "good luck :)");
        assert.strictEqual((await aliceGetsDisturb).team, "B");
    });

    test("player can rejoin after a refresh with the token", async () => {
        const { alice, roomId, aliceToken, state } = await setupGame();
        const oldId = state.me.id;
        alice.disconnect();

        const again = newClient();
        const rejoined = waitFor(again, "roomState");
        again.emit("rejoinRoom", { roomId, token: aliceToken });
        const newState = await rejoined;

        assert.strictEqual(newState.me.id, oldId);
        assert.strictEqual(newState.myTeam, "A");
        assert.strictEqual(newState.status, "running");
    });

    test("wrong token can't take someone's spot", async () => {
        const { roomId } = await setupGame();
        const attacker = newClient();

        const failed = waitFor(attacker, "rejoinFailed");
        attacker.emit("rejoinRoom", { roomId, token: "not-a-real-token" });
        await failed;
    });

    test("bad payloads don't crash the server", async () => {
        const client = newClient();
        client.emit("createRoom", null);
        client.emit("joinRoom", { roomId: "constructor" });
        client.emit("joinRoom", { roomId: { $gt: "" }, username: 5 });
        client.emit("joinTeam", { team: "A" });
        client.emit("codeUpdate", "nonsense");
        client.emit("rejoinRoom", 123);
        client.emit("startGame", undefined);

        const other = newClient();
        const { roomId } = await createRoom(other, "survivor");
        assert.match(roomId, /^[A-Z0-9]{5}$/);
    });
});

describe("handle verification", () => {
    beforeEach(() => {
        config.VERIFY_HANDLES = true;
        fakeSubmissions = [];
    });

    afterEach(() => {
        config.VERIFY_HANDLES = false;
    });

    function compileError(problem) {
        return {
            id: 99,
            problem: { contestId: problem.contestId, index: problem.index },
            verdict: "COMPILATION_ERROR",
            creationTimeSeconds: Math.floor(Date.now() / 1000)
        };
    }

    async function startCreate(client, handle, verifyToken = "") {
        const challenge = waitFor(client, "verificationNeeded");
        client.emit("createRoom", { username: handle, handle, verifyToken });
        return challenge;
    }

    test("asks for proof before making a room", async () => {
        const client = newClient();
        const noRoom = notReceived(client, "joinedRoom");
        const challenge = await startCreate(client, "alice");

        assert.strictEqual(challenge.handle, "alice");
        assert.ok(PROBLEMS.some((p) => p.contestId === challenge.problem.contestId));
        assert.strictEqual(await noRoom, true);
    });

    test("no submission, or the wrong verdict, is not accepted", async () => {
        const client = newClient();
        const challenge = await startCreate(client, "alice");

        let error = waitFor(client, "errorMessage");
        client.emit("checkVerification", { challengeId: challenge.challengeId });
        assert.match(await error, /Didn't find the submission/);

        fakeSubmissions = [{ ...compileError(challenge.problem), verdict: "OK" }];
        error = waitFor(client, "errorMessage");
        client.emit("checkVerification", { challengeId: challenge.challengeId });
        assert.match(await error, /Didn't find the submission/);
    });

    test("a compile error on the given problem verifies and creates the room", async () => {
        const client = newClient();
        const challenge = await startCreate(client, "alice");
        fakeSubmissions = [compileError(challenge.problem)];

        const verified = waitFor(client, "handleVerified");
        const joined = waitFor(client, "joinedRoom");
        client.emit("checkVerification", { challengeId: challenge.challengeId });

        const { handle, verifyToken } = await verified;
        assert.strictEqual(handle, "alice");
        assert.ok(verifyToken);
        assert.match((await joined).roomId, /^[A-Z0-9]{5}$/);
    });

    test("a verified handle can skip the check next time, other handles can't", async () => {
        const client = newClient();
        const challenge = await startCreate(client, "alice");
        fakeSubmissions = [compileError(challenge.problem)];
        const verified = waitFor(client, "handleVerified");
        client.emit("checkVerification", { challengeId: challenge.challengeId });
        const { verifyToken } = await verified;

        const again = newClient();
        const joined = waitFor(again, "joinedRoom");
        again.emit("createRoom", { username: "alice", handle: "alice", verifyToken });
        await joined;

        const thief = newClient();
        const otherChallenge = await startCreate(thief, "bob", verifyToken);
        assert.strictEqual(otherChallenge.handle, "bob");
    });

    test("joining a room needs verification too", async () => {
        config.VERIFY_HANDLES = false;
        const host = newClient();
        const { roomId } = await createRoom(host, "alice");
        config.VERIFY_HANDLES = true;

        const bob = newClient();
        const challengePromise = waitFor(bob, "verificationNeeded");
        bob.emit("joinRoom", { roomId, username: "bob", handle: "bob" });
        const challenge = await challengePromise;

        fakeSubmissions = [compileError(challenge.problem)];
        const hostSeesBob = waitFor(host, "roomState", (s) => s.players.length === 2);
        bob.emit("checkVerification", { challengeId: challenge.challengeId });
        await hostSeesBob;
    });

    test("the challenge survives a reconnect", async () => {
        const first = newClient();
        const challenge = await startCreate(first, "alice");
        first.disconnect();

        fakeSubmissions = [compileError(challenge.problem)];
        const second = newClient();
        const joined = waitFor(second, "joinedRoom");
        second.emit("checkVerification", { challengeId: challenge.challengeId });
        assert.match((await joined).roomId, /^[A-Z0-9]{5}$/);
    });

    test("a made up challenge id doesn't work", async () => {
        const client = newClient();
        await startCreate(client, "alice");

        const cancelled = waitFor(client, "verificationCancelled");
        client.emit("checkVerification", { challengeId: "not-a-real-id" });
        assert.match(await cancelled, /start again/);
    });

    test("checking with nothing to verify tells the client to start again", async () => {
        const client = newClient();
        const cancelled = waitFor(client, "verificationCancelled");
        client.emit("checkVerification");
        assert.match(await cancelled, /start again/);
    });
});

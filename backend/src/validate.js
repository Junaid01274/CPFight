const { MAX_USERNAME_LENGTH } = require("./config");

const HANDLE_REGEX = /^[a-zA-Z0-9_.-]{3,24}$/;
const ROOM_ID_REGEX = /^[A-Z0-9]{5}$/;

function cleanString(value) {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim();
}

function checkPlayerInfo(username, handle) {
    if (!username) {
        return "Username is required";
    }
    if (username.length > MAX_USERNAME_LENGTH) {
        return `Username can be at most ${MAX_USERNAME_LENGTH} characters`;
    }
    if (!handle) {
        return "Codeforces handle is required";
    }
    if (!HANDLE_REGEX.test(handle)) {
        return "That doesn't look like a valid Codeforces handle";
    }
    return null;
}

function normalizeRoomId(value) {
    return cleanString(value).toUpperCase();
}

function isValidRoomId(roomId) {
    return ROOM_ID_REGEX.test(roomId);
}

module.exports = {
    cleanString,
    checkPlayerInfo,
    normalizeRoomId,
    isValidRoomId
};

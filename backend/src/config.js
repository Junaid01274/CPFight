require("dotenv").config({ quiet: true });

const MAX_TEAM_SIZE = 3;
const FAKE_CODEFORCES = process.env.FAKE_CODEFORCES === "true";

module.exports = {
    PORT: Number(process.env.PORT) || 5000,
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

    FAKE_CODEFORCES,

    GAME_DURATION_MS: (Number(process.env.GAME_MINUTES) || 30) * 60 * 1000,
    PROBLEMS_PER_GAME: 6,
    MAX_TEAM_SIZE,
    MAX_PLAYERS: MAX_TEAM_SIZE * 2,

    MAX_USERNAME_LENGTH: 20,
    MAX_CODE_LENGTH: 64 * 1024,
    MAX_MESSAGE_LENGTH: 500,
    MAX_MESSAGES: 100,
    CHAT_COOLDOWN_MS: 500,

    SUBMISSION_POLL_MS: 10 * 1000,
    MANUAL_REFRESH_COOLDOWN_MS: 15 * 1000,

    VERIFY_HANDLES: process.env.VERIFY_HANDLES
        ? process.env.VERIFY_HANDLES === "true"
        : !FAKE_CODEFORCES,
    VERIFY_TIME_LIMIT_MS: 3 * 60 * 1000,
    VERIFY_CHECK_COOLDOWN_MS: 5 * 1000,
    VERIFIED_HANDLE_TTL_MS: 24 * 60 * 60 * 1000,

    LOBBY_RECONNECT_GRACE_MS: 30 * 1000,
    EMPTY_ROOM_TTL_MS: 5 * 60 * 1000
};

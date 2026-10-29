const config = require("./config");
const store = require("./roomStore");
const game = require("./room");
const { sendState } = require("./broadcast");
const { checkSubmissions } = require("./submissions");

function tick(io, now = Date.now()) {
    for (const room of store.getAllRooms()) {
        if (game.isTimeUp(room, now)) {
            game.endGame(room);
            console.log(`Game ended in ${room.id}, winner: ${room.winner}`);
            sendState(io, room);
        }

        if (game.removeGonePlayers(room, now)) {
            sendState(io, room);
        }

        if (game.shouldDeleteRoom(room, now)) {
            store.deleteRoom(room.id);
            console.log(`Deleted room ${room.id}`);
        }
    }
}

let pollRunning = false;

async function pollSubmissions(io) {
    if (pollRunning) {
        return;
    }

    pollRunning = true;
    try {
        for (const room of store.getAllRooms()) {
            if (room.status === "running") {
                await checkSubmissions(io, room);
            }
        }
    } finally {
        pollRunning = false;
    }
}

function startJobs(io) {
    setInterval(() => {
        try {
            tick(io);
        } catch (error) {
            console.error("tick failed:", error);
        }
    }, 1000);

    setInterval(() => {
        pollSubmissions(io).catch((error) => {
            console.error("submission poll failed:", error);
        });
    }, config.SUBMISSION_POLL_MS);
}

module.exports = {
    tick,
    pollSubmissions,
    startJobs
};

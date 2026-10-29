const codeforces = require("./codeforces");
const { applySubmissions } = require("./room");
const { sendState } = require("./broadcast");

async function checkSubmissions(io, room) {
    let changed = false;

    for (const player of room.players) {
        if (!player.team) {
            continue;
        }

        try {
            const list = await codeforces.getRecentSubmissions(player.handle);
            if (applySubmissions(room, player, list)) {
                changed = true;
            }
        } catch (error) {
            console.log(`Could not get submissions for ${player.handle}: ${error.message}`);
        }
    }

    if (changed) {
        sendState(io, room);
    }
    return changed;
}

module.exports = {
    checkSubmissions
};

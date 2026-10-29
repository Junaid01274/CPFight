const { buildStateFor } = require("./state");

function sendState(io, room) {
    const now = Date.now();

    for (const player of room.players) {
        if (player.connected) {
            io.to(player.socketId).emit("roomState", buildStateFor(room, player, now));
        }
    }
}

function emitToTeam(io, room, team, event, data, skipPlayerId = null) {
    for (const player of room.players) {
        if (player.team === team && player.connected && player.id !== skipPlayerId) {
            io.to(player.socketId).emit(event, data);
        }
    }
}

function emitToRoom(io, room, event, data) {
    for (const player of room.players) {
        if (player.connected) {
            io.to(player.socketId).emit(event, data);
        }
    }
}

module.exports = {
    sendState,
    emitToTeam,
    emitToRoom
};

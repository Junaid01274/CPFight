const crypto = require("crypto");

// Map instead of {} so a roomId like "constructor" can never look like a room
const rooms = new Map();

const socketToPlayer = new Map();

const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomId() {
    let roomId;

    do {
        roomId = "";
        for (let i = 0; i < 5; i++) {
            roomId += ROOM_ID_CHARS[crypto.randomInt(ROOM_ID_CHARS.length)];
        }
    } while (rooms.has(roomId));

    return roomId;
}

function addRoom(room) {
    rooms.set(room.id, room);
}

function getRoom(roomId) {
    return rooms.get(roomId);
}

function deleteRoom(roomId) {
    rooms.delete(roomId);

    for (const [socketId, info] of socketToPlayer) {
        if (info.roomId === roomId) {
            socketToPlayer.delete(socketId);
        }
    }
}

function getAllRooms() {
    return [...rooms.values()];
}

function linkSocket(socketId, roomId, playerId) {
    socketToPlayer.set(socketId, { roomId, playerId });
}

function unlinkSocket(socketId) {
    socketToPlayer.delete(socketId);
}

function getSocketInfo(socketId) {
    return socketToPlayer.get(socketId);
}

function clearAll() {
    rooms.clear();
    socketToPlayer.clear();
}

module.exports = {
    generateRoomId,
    addRoom,
    getRoom,
    deleteRoom,
    getAllRooms,
    linkSocket,
    unlinkSocket,
    getSocketInfo,
    clearAll
};

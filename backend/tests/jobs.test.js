const { test, beforeEach } = require("node:test");
const assert = require("node:assert");

const store = require("../src/roomStore");
const game = require("../src/room");
const config = require("../src/config");
const { tick } = require("../src/jobs");
const { makeRunningGame } = require("./helpers");

function makeFakeIo() {
    const sent = [];
    return {
        sent,
        to(socketId) {
            return {
                emit(event, data) {
                    sent.push({ socketId, event, data });
                }
            };
        }
    };
}

beforeEach(() => {
    store.clearAll();
});

test("tick ends the game when time is up and tells everyone", () => {
    const { room } = makeRunningGame(0);
    store.addRoom(room);
    const io = makeFakeIo();

    tick(io, room.endsAt - 1000);
    assert.strictEqual(room.status, "running");
    assert.strictEqual(io.sent.length, 0);

    tick(io, room.endsAt);
    assert.strictEqual(room.status, "finished");
    assert.strictEqual(io.sent.length, 2);
    assert.strictEqual(io.sent[0].event, "roomState");
    assert.strictEqual(io.sent[0].data.status, "finished");
});

test("tick deletes rooms nobody came back to", () => {
    const { room, alice, bob } = makeRunningGame(0);
    store.addRoom(room);
    game.markDisconnected(room, alice, 0);
    game.markDisconnected(room, bob, 0);

    tick(makeFakeIo(), 1000);
    assert.ok(store.getRoom(room.id));

    tick(makeFakeIo(), config.EMPTY_ROOM_TTL_MS + 1000);
    assert.strictEqual(store.getRoom(room.id), undefined);
});

const { test, beforeEach } = require("node:test");
const assert = require("node:assert");

const store = require("../src/roomStore");
const game = require("../src/room");

beforeEach(() => {
    store.clearAll();
});

test("room ids are 5 characters and unique", () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) {
        const id = store.generateRoomId();
        assert.match(id, /^[A-Z0-9]{5}$/);
        assert.ok(!ids.has(id));
        ids.add(id);
        store.addRoom(game.createRoom(id));
    }
});

test("special names like constructor are not rooms", () => {
    assert.strictEqual(store.getRoom("constructor"), undefined);
    assert.strictEqual(store.getRoom("__proto__"), undefined);
    assert.strictEqual(store.getRoom("toString"), undefined);
});

test("deleting a room also removes its socket links", () => {
    const room = game.createRoom("ABCDE");
    store.addRoom(room);
    store.linkSocket("socket-1", "ABCDE", "player-1");
    store.linkSocket("socket-2", "OTHER", "player-2");

    store.deleteRoom("ABCDE");

    assert.strictEqual(store.getRoom("ABCDE"), undefined);
    assert.strictEqual(store.getSocketInfo("socket-1"), undefined);
    assert.deepStrictEqual(store.getSocketInfo("socket-2"), { roomId: "OTHER", playerId: "player-2" });
});

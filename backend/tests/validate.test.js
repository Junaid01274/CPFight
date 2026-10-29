const { test } = require("node:test");
const assert = require("node:assert");

const {
    cleanString,
    checkPlayerInfo,
    normalizeRoomId,
    isValidRoomId
} = require("../src/validate");

test("cleanString turns anything that is not a string into empty string", () => {
    assert.strictEqual(cleanString("  hi  "), "hi");
    assert.strictEqual(cleanString(null), "");
    assert.strictEqual(cleanString(undefined), "");
    assert.strictEqual(cleanString(42), "");
    assert.strictEqual(cleanString({ toString: () => "hacked" }), "");
});

test("valid username and handle pass", () => {
    assert.strictEqual(checkPlayerInfo("Junaid", "tourist"), null);
    assert.strictEqual(checkPlayerInfo("a", "Um_nik"), null);
    assert.strictEqual(checkPlayerInfo("a", "some.user-1"), null);
});

test("bad usernames are rejected", () => {
    assert.strictEqual(checkPlayerInfo("", "tourist"), "Username is required");
    assert.match(checkPlayerInfo("x".repeat(21), "tourist"), /at most/);
});

test("bad handles are rejected before calling codeforces", () => {
    assert.strictEqual(checkPlayerInfo("a", ""), "Codeforces handle is required");
    assert.match(checkPlayerInfo("a", "ab"), /valid Codeforces handle/);
    assert.match(checkPlayerInfo("a", "x".repeat(25)), /valid Codeforces handle/);
    assert.match(checkPlayerInfo("a", "tour ist"), /valid Codeforces handle/);
    assert.match(checkPlayerInfo("a", "a&handles=b"), /valid Codeforces handle/);
});

test("room ids", () => {
    assert.strictEqual(normalizeRoomId("  ab3cd "), "AB3CD");
    assert.strictEqual(isValidRoomId("AB3CD"), true);
    assert.strictEqual(isValidRoomId("AB3C"), false);
    assert.strictEqual(isValidRoomId("CONSTRUCTOR"), false);
    assert.strictEqual(isValidRoomId(normalizeRoomId(null)), false);
});

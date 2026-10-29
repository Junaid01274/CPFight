const { test } = require("node:test");
const assert = require("node:assert");

const game = require("../src/room");
const { buildStateFor } = require("../src/state");
const { makePlayer, makeRunningGame, PROBLEMS, cfSubmission } = require("./helpers");

function makeGameWithCode() {
    const { room, alice, bob } = makeRunningGame();
    const ann = makePlayer("ann");
    ann.team = "A";
    room.players.push(ann);

    game.updateCode(room, alice, "4A", "alice code");
    game.updateCode(room, ann, "4A", "ann code");
    game.updateCode(room, bob, "4A", "bob secret code");

    return { room, alice, ann, bob };
}

test("player sees teammates code but never the other team's code", () => {
    const { room, alice, ann, bob } = makeGameWithCode();
    const state = buildStateFor(room, alice);

    assert.deepStrictEqual(Object.keys(state.teamCodes), [ann.id]);
    assert.strictEqual(state.teamCodes[ann.id].codes["4A"], "ann code");

    const json = JSON.stringify(state);
    assert.ok(!json.includes("bob secret code"));
    assert.strictEqual(state.teamCodes[bob.id], undefined);
});

test("own code is in `me`, not in teamCodes", () => {
    const { room, alice } = makeGameWithCode();
    const state = buildStateFor(room, alice);

    assert.strictEqual(state.me.codes["4A"], "alice code");
    assert.strictEqual(state.teamCodes[alice.id], undefined);
});

test("tokens are never sent in the state", () => {
    const { room, alice, ann, bob } = makeGameWithCode();
    const json = JSON.stringify(buildStateFor(room, alice));

    for (const player of [alice, ann, bob]) {
        assert.ok(!json.includes(player.token));
    }
});

test("team chat only shows your own team's messages", () => {
    const { room, alice, bob } = makeRunningGame();
    game.addTeamMessage(room, alice, "plan for team A", 1000);
    game.addTeamMessage(room, bob, "plan for team B", 1000);

    const stateA = buildStateFor(room, alice);
    assert.strictEqual(stateA.teamMessages.length, 1);
    assert.strictEqual(stateA.teamMessages[0].message, "plan for team A");
});

test("team submission shows the latest one from any teammate", () => {
    const { room, alice, ann } = makeGameWithCode();
    const start = Math.floor(room.startedAt / 1000);
    const watermelon = PROBLEMS[0];

    game.applySubmissions(room, alice, [cfSubmission(1, watermelon, "WRONG_ANSWER", start + 10)]);
    game.applySubmissions(room, ann, [cfSubmission(2, watermelon, "OK", start + 20)]);

    const state = buildStateFor(room, alice);
    assert.strictEqual(state.submissions["4A"].A.verdict, "OK");
    assert.strictEqual(state.submissions["4A"].A.username, "ann");
    assert.strictEqual(state.submissions["4A"].B, null);
    assert.deepStrictEqual(state.solved.A, { "4A": start + 20 });
    assert.strictEqual(state.scores.A, 1);
});

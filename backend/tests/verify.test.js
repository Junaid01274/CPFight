const { test } = require("node:test");
const assert = require("node:assert");

const verify = require("../src/verify");
const config = require("../src/config");
const { PROBLEMS } = require("./helpers");

const NOW = 1_800_000_000_000;
const NOW_SEC = NOW / 1000;

function submission(problem, verdict, timeSeconds) {
    return {
        id: 1,
        problem: { contestId: problem.contestId, index: problem.index },
        verdict,
        creationTimeSeconds: timeSeconds
    };
}

test("challenge picks one of the problems and expires later", () => {
    const challenge = verify.createChallenge("tourist", PROBLEMS, NOW);

    assert.ok(PROBLEMS.some((p) => p.contestId === challenge.problem.contestId));
    assert.strictEqual(challenge.handle, "tourist");
    assert.strictEqual(challenge.expiresAt, NOW + config.VERIFY_TIME_LIMIT_MS);
    assert.strictEqual(verify.isExpired(challenge, NOW + 1000), false);
    assert.strictEqual(verify.isExpired(challenge, challenge.expiresAt + 1), true);
});

test("a compile error on the right problem after the challenge is proof", () => {
    const challenge = verify.createChallenge("tourist", PROBLEMS, NOW);
    const list = [submission(challenge.problem, "COMPILATION_ERROR", NOW_SEC + 20)];

    assert.strictEqual(verify.hasProof(challenge, list), true);
});

test("other problems, other verdicts and old submissions are not proof", () => {
    const challenge = verify.createChallenge("tourist", PROBLEMS, NOW);
    const other = PROBLEMS.find((p) => p.contestId !== challenge.problem.contestId);

    assert.strictEqual(verify.hasProof(challenge, []), false);
    assert.strictEqual(
        verify.hasProof(challenge, [submission(other, "COMPILATION_ERROR", NOW_SEC + 20)]),
        false
    );
    assert.strictEqual(
        verify.hasProof(challenge, [submission(challenge.problem, "OK", NOW_SEC + 20)]),
        false
    );
    assert.strictEqual(
        verify.hasProof(challenge, [submission(challenge.problem, "COMPILATION_ERROR", NOW_SEC - 3600)]),
        false
    );
});

test("pending challenges can be saved, found and removed by id", () => {
    const challenge = verify.createChallenge("tourist", PROBLEMS, NOW);
    const action = { type: "create", username: "t" };
    verify.savePending(challenge, action, NOW);

    assert.deepStrictEqual(verify.getPending(challenge.id), { challenge, action });
    assert.strictEqual(verify.getPending("nope"), null);

    verify.removePending(challenge.id);
    assert.strictEqual(verify.getPending(challenge.id), null);
});

test("every challenge gets a different id", () => {
    const a = verify.createChallenge("tourist", PROBLEMS, NOW);
    const b = verify.createChallenge("tourist", PROBLEMS, NOW);
    assert.notStrictEqual(a.id, b.id);
});

test("remembered handle works for the same handle only", () => {
    const token = verify.rememberHandle("Tourist", NOW);

    assert.strictEqual(verify.isRemembered(token, "tourist", NOW), true);
    assert.strictEqual(verify.isRemembered(token, "TOURIST", NOW), true);
    assert.strictEqual(verify.isRemembered(token, "petr", NOW), false);
    assert.strictEqual(verify.isRemembered("made-up-token", "tourist", NOW), false);
    assert.strictEqual(verify.isRemembered("", "tourist", NOW), false);
});

test("remembered handle runs out after the ttl", () => {
    const token = verify.rememberHandle("tourist", NOW);
    const later = NOW + config.VERIFIED_HANDLE_TTL_MS + 1;

    assert.strictEqual(verify.isRemembered(token, "tourist", later), false);
});

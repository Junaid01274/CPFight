const { test } = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { loadProblems, pickRandomProblems } = require("../src/problems");

const realProblems = loadProblems(path.join(__dirname, "..", "data", "problems.json"));

test("problems.json has everything the game needs", () => {
    const ids = new Set();

    for (const problem of realProblems) {
        assert.strictEqual(problem.id, `${problem.contestId}${problem.index}`);
        assert.ok(problem.name);
        assert.ok(problem.codeforcesUrl.startsWith("https://codeforces.com/"));
        assert.ok(problem.submitUrl.startsWith("https://codeforces.com/"));
        assert.ok(!ids.has(problem.id), `duplicate problem ${problem.id}`);
        ids.add(problem.id);
    }
});

test("pickRandomProblems returns distinct problems", () => {
    const picked = pickRandomProblems(realProblems, 6);
    assert.strictEqual(picked.length, 6);
    assert.strictEqual(new Set(picked.map((p) => p.id)).size, 6);
});

test("pickRandomProblems doesn't change the original list", () => {
    const before = realProblems.map((p) => p.id);
    pickRandomProblems(realProblems, 6);
    assert.deepStrictEqual(realProblems.map((p) => p.id), before);
});

test("asking for more problems than we have returns all of them", () => {
    const picked = pickRandomProblems(realProblems.slice(0, 3), 10);
    assert.strictEqual(picked.length, 3);
});

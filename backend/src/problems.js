const fs = require("fs");

function loadProblems(filePath) {
    const problems = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    if (!Array.isArray(problems) || problems.length === 0) {
        throw new Error("problems.json should be a non empty array");
    }

    return problems;
}

function pickRandomProblems(problems, count) {
    const copy = [...problems];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy.slice(0, count);
}

module.exports = {
    loadProblems,
    pickRandomProblems
};

// to prove a handle is yours, submit a compile error to the problem we pick
const crypto = require("crypto");
const config = require("./config");

const CLOCK_MARGIN_SEC = 60;

function createChallenge(handle, problems, now = Date.now()) {
    const problem = problems[crypto.randomInt(problems.length)];

    return {
        id: crypto.randomUUID(),
        handle,
        problem: {
            contestId: problem.contestId,
            index: problem.index,
            name: problem.name,
            submitUrl: problem.submitUrl
        },
        issuedAt: now,
        expiresAt: now + config.VERIFY_TIME_LIMIT_MS,
        lastCheckAt: 0
    };
}

function isExpired(challenge, now = Date.now()) {
    return now > challenge.expiresAt;
}

function hasProof(challenge, submissions) {
    const fromSec = Math.floor(challenge.issuedAt / 1000) - CLOCK_MARGIN_SEC;

    return submissions.some(
        (s) =>
            s.problem &&
            s.problem.contestId === challenge.problem.contestId &&
            s.problem.index === challenge.problem.index &&
            s.verdict === "COMPILATION_ERROR" &&
            s.creationTimeSeconds >= fromSec
    );
}

const pendingChallenges = new Map();

function savePending(challenge, action, now = Date.now()) {
    if (pendingChallenges.size > 1000) {
        for (const [id, entry] of pendingChallenges) {
            if (isExpired(entry.challenge, now)) {
                pendingChallenges.delete(id);
            }
        }
    }
    pendingChallenges.set(challenge.id, { challenge, action });
}

function getPending(id) {
    return pendingChallenges.get(id) || null;
}

function removePending(id) {
    pendingChallenges.delete(id);
}

const verifiedTokens = new Map();

function rememberHandle(handle, now = Date.now()) {
    if (verifiedTokens.size > 5000) {
        for (const [token, entry] of verifiedTokens) {
            if (now > entry.expiresAt) {
                verifiedTokens.delete(token);
            }
        }
    }

    const token = crypto.randomUUID();
    verifiedTokens.set(token, {
        handle: handle.toLowerCase(),
        expiresAt: now + config.VERIFIED_HANDLE_TTL_MS
    });
    return token;
}

function isRemembered(token, handle, now = Date.now()) {
    const entry = verifiedTokens.get(token);
    if (!entry) {
        return false;
    }
    if (now > entry.expiresAt) {
        verifiedTokens.delete(token);
        return false;
    }
    return entry.handle === handle.toLowerCase();
}

module.exports = {
    createChallenge,
    isExpired,
    hasProof,
    savePending,
    getPending,
    removePending,
    rememberHandle,
    isRemembered
};

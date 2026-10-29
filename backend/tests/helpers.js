const game = require("../src/room");

const PROBLEMS = [
    { id: "4A", contestId: 4, index: "A", name: "Watermelon" },
    { id: "71A", contestId: 71, index: "A", name: "Way Too Long Words" },
    { id: "1A", contestId: 1, index: "A", name: "Theatre Square" }
];

function makePlayer(handle) {
    return game.createPlayer(`${handle}-socket`, handle, { handle, rating: 1200 });
}

function makeLobby() {
    const room = game.createRoom("ABCDE");
    const alice = makePlayer("alice");
    const bob = makePlayer("bob");

    game.addPlayer(room, alice);
    game.addPlayer(room, bob);
    game.joinTeam(room, alice, "A");
    game.joinTeam(room, bob, "B");

    return { room, alice, bob };
}

function makeRunningGame(startMs = 1_000_000_000_000) {
    const lobby = makeLobby();
    game.startGame(lobby.room, lobby.alice, PROBLEMS, startMs);
    return lobby;
}

function cfSubmission(id, problem, verdict, timeSeconds) {
    return {
        id,
        problem: { contestId: problem.contestId, index: problem.index },
        verdict,
        programmingLanguage: "GNU C++17",
        creationTimeSeconds: timeSeconds
    };
}

module.exports = {
    PROBLEMS,
    makePlayer,
    makeLobby,
    makeRunningGame,
    cfSubmission
};

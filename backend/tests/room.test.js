const { describe, test } = require("node:test");
const assert = require("node:assert");

const game = require("../src/room");
const config = require("../src/config");
const {
    PROBLEMS,
    makePlayer,
    makeLobby,
    makeRunningGame,
    cfSubmission
} = require("./helpers");

const START_MS = 1_000_000_000_000;
const START_SEC = START_MS / 1000;

describe("joining a room", () => {
    test("first player becomes the host", () => {
        const room = game.createRoom("ABCDE");
        const alice = makePlayer("alice");

        assert.strictEqual(game.addPlayer(room, alice), null);
        assert.strictEqual(room.hostId, alice.id);
    });

    test("same handle can't join twice, even with different case", () => {
        const room = game.createRoom("ABCDE");
        game.addPlayer(room, makePlayer("tourist"));

        const error = game.addPlayer(room, makePlayer("TOURIST"));
        assert.match(error, /already in the room/);
        assert.strictEqual(room.players.length, 1);
    });

    test("room is full after MAX_PLAYERS", () => {
        const room = game.createRoom("ABCDE");
        for (let i = 0; i < config.MAX_PLAYERS; i++) {
            assert.strictEqual(game.addPlayer(room, makePlayer(`user${i}`)), null);
        }

        assert.strictEqual(game.addPlayer(room, makePlayer("onemore")), "Room is full");
    });

    test("can't join after the game started", () => {
        const { room } = makeRunningGame();
        assert.strictEqual(game.addPlayer(room, makePlayer("late")), "Game has already started");
    });

    test("missing room gives an error", () => {
        assert.strictEqual(game.canJoin(undefined), "Room does not exist");
    });
});

describe("teams", () => {
    test("team can't have more than MAX_TEAM_SIZE players", () => {
        const room = game.createRoom("ABCDE");
        const players = [];
        for (let i = 0; i <= config.MAX_TEAM_SIZE; i++) {
            const p = makePlayer(`user${i}`);
            game.addPlayer(room, p);
            players.push(p);
        }

        for (let i = 0; i < config.MAX_TEAM_SIZE; i++) {
            assert.strictEqual(game.joinTeam(room, players[i], "A"), null);
        }
        assert.strictEqual(game.joinTeam(room, players[config.MAX_TEAM_SIZE], "A"), "Team A is full");
    });

    test("only A and B are valid teams", () => {
        const { room, alice } = makeLobby();
        assert.strictEqual(game.joinTeam(room, alice, "C"), "Invalid team");
        assert.strictEqual(game.joinTeam(room, alice, null), "Invalid team");
        assert.strictEqual(alice.team, "A");
    });

    test("host passes to the next player when the host leaves", () => {
        const { room, alice, bob } = makeLobby();
        game.removePlayer(room, alice.id);
        assert.strictEqual(room.hostId, bob.id);
    });

    test("host prefers a player who is still online", () => {
        const { room, alice, bob } = makeLobby();
        const carol = makePlayer("carol");
        game.addPlayer(room, carol);
        game.markDisconnected(room, bob);

        game.removePlayer(room, alice.id);
        assert.strictEqual(room.hostId, carol.id);
    });
});

describe("starting the game", () => {
    test("only the host can start", () => {
        const { room, bob } = makeLobby();
        assert.strictEqual(game.startGame(room, bob, PROBLEMS), "Only the host can start the game");
        assert.strictEqual(room.status, "lobby");
    });

    test("both teams need a player", () => {
        const room = game.createRoom("ABCDE");
        const alice = makePlayer("alice");
        game.addPlayer(room, alice);
        game.joinTeam(room, alice, "A");

        assert.strictEqual(game.startGame(room, alice, PROBLEMS), "Team B needs at least one player");
    });

    test("sets the end time from the game duration", () => {
        const { room, alice } = makeLobby();
        assert.strictEqual(game.startGame(room, alice, PROBLEMS, START_MS), null);

        assert.strictEqual(room.status, "running");
        assert.strictEqual(room.startedAt, START_MS);
        assert.strictEqual(room.endsAt, START_MS + config.GAME_DURATION_MS);
        assert.deepStrictEqual(room.problems, PROBLEMS);
    });

    test("players without a team go to the smaller team", () => {
        const { room, alice } = makeLobby();
        const carol = makePlayer("carol");
        const dave = makePlayer("dave");
        game.addPlayer(room, carol);
        game.addPlayer(room, dave);
        game.joinTeam(room, carol, "A");

        game.startGame(room, alice, PROBLEMS);
        assert.strictEqual(dave.team, "B");
    });

    test("can't start twice", () => {
        const { room, alice } = makeRunningGame();
        assert.strictEqual(game.startGame(room, alice, PROBLEMS), "Game has already started");
    });
});

describe("code updates", () => {
    test("saves code for a problem in the game", () => {
        const { room, alice } = makeRunningGame();
        assert.strictEqual(game.updateCode(room, alice, "4A", "int main() {}"), null);
        assert.strictEqual(alice.codes["4A"], "int main() {}");
    });

    test("rejects problems that are not in this game", () => {
        const { room, alice } = makeRunningGame();
        assert.strictEqual(game.updateCode(room, alice, "999Z", "x"), "Invalid problem");
        assert.strictEqual(game.updateCode(room, alice, "constructor", "x"), "Invalid problem");
    });

    test("rejects code that is too long or not a string", () => {
        const { room, alice } = makeRunningGame();
        const huge = "a".repeat(config.MAX_CODE_LENGTH + 1);
        assert.strictEqual(game.updateCode(room, alice, "4A", huge), "Code is too long to share");
        assert.strictEqual(game.updateCode(room, alice, "4A", { evil: true }), "Invalid code");
    });

    test("can't send code in the lobby", () => {
        const { room, alice } = makeLobby();
        assert.strictEqual(game.updateCode(room, alice, "4A", "x"), "Game is not running");
    });
});

describe("chat", () => {
    test("team message goes to the sender's team only", () => {
        const { room, alice } = makeLobby();
        const message = game.addTeamMessage(room, alice, "hello", 1000);

        assert.strictEqual(message.message, "hello");
        assert.strictEqual(room.teamMessages.A.length, 1);
        assert.strictEqual(room.teamMessages.B.length, 0);
    });

    test("empty messages and spam are ignored", () => {
        const { room, alice } = makeLobby();
        assert.strictEqual(game.addTeamMessage(room, alice, "", 1000), null);

        assert.ok(game.addTeamMessage(room, alice, "one", 1000));
        assert.strictEqual(game.addTeamMessage(room, alice, "two", 1100), null);
        assert.ok(game.addTeamMessage(room, alice, "three", 1000 + config.CHAT_COOLDOWN_MS));
    });

    test("long messages are cut and old messages are dropped", () => {
        const { room, alice } = makeLobby();
        let time = 0;
        for (let i = 0; i < config.MAX_MESSAGES + 5; i++) {
            time += config.CHAT_COOLDOWN_MS;
            game.addDisturbMessage(room, alice, "x".repeat(1000), time);
        }

        assert.strictEqual(room.disturbMessages.length, config.MAX_MESSAGES);
        assert.strictEqual(room.disturbMessages[0].message.length, config.MAX_MESSAGE_LENGTH);
    });
});

describe("applySubmissions", () => {
    const [watermelon, words] = PROBLEMS;

    test("counts an accepted submission made during the game", () => {
        const { room, alice } = makeRunningGame(START_MS);
        const changed = game.applySubmissions(room, alice, [
            cfSubmission(1, watermelon, "OK", START_SEC + 60)
        ]);

        assert.strictEqual(changed, true);
        assert.strictEqual(game.getScore(room, "A"), 1);
        assert.strictEqual(alice.submissions["4A"].verdict, "OK");
    });

    test("uses seconds, not milliseconds, when comparing times", () => {
        const { room, alice } = makeRunningGame(START_MS);
        game.applySubmissions(room, alice, [
            cfSubmission(1, watermelon, "OK", START_SEC + 1)
        ]);
        assert.strictEqual(game.getScore(room, "A"), 1);
    });

    test("ignores submissions from before the game started", () => {
        const { room, alice } = makeRunningGame(START_MS);
        const changed = game.applySubmissions(room, alice, [
            cfSubmission(1, watermelon, "OK", START_SEC - 3600)
        ]);

        assert.strictEqual(changed, false);
        assert.strictEqual(game.getScore(room, "A"), 0);
    });

    test("ignores submissions after the game ended", () => {
        const { room, alice } = makeRunningGame(START_MS);
        const endSec = room.endsAt / 1000;
        game.applySubmissions(room, alice, [
            cfSubmission(1, watermelon, "OK", endSec + 10)
        ]);
        assert.strictEqual(game.getScore(room, "A"), 0);
    });

    test("an AC still counts if a later submission got WA", () => {
        const { room, alice } = makeRunningGame(START_MS);
        game.applySubmissions(room, alice, [
            cfSubmission(2, watermelon, "WRONG_ANSWER", START_SEC + 120),
            cfSubmission(1, watermelon, "OK", START_SEC + 60)
        ]);

        assert.strictEqual(game.getScore(room, "A"), 1);
        assert.strictEqual(room.solved.A["4A"], START_SEC + 60);
        assert.strictEqual(alice.submissions["4A"].verdict, "WRONG_ANSWER");
    });

    test("submission still being judged shows as TESTING", () => {
        const { room, alice } = makeRunningGame(START_MS);
        game.applySubmissions(room, alice, [
            cfSubmission(1, words, undefined, START_SEC + 30)
        ]);

        assert.strictEqual(alice.submissions["71A"].verdict, "TESTING");
        assert.strictEqual(game.getScore(room, "A"), 0);
    });

    test("returns false when nothing new happened", () => {
        const { room, alice } = makeRunningGame(START_MS);
        const list = [cfSubmission(1, watermelon, "OK", START_SEC + 60)];

        assert.strictEqual(game.applySubmissions(room, alice, list), true);
        assert.strictEqual(game.applySubmissions(room, alice, list), false);
    });

    test("team keeps the earliest AC time between teammates", () => {
        const { room, alice } = makeRunningGame(START_MS);
        const ann = makePlayer("ann");
        ann.team = "A";
        room.players.push(ann);

        game.applySubmissions(room, alice, [cfSubmission(1, watermelon, "OK", START_SEC + 300)]);
        game.applySubmissions(room, ann, [cfSubmission(2, watermelon, "OK", START_SEC + 100)]);

        assert.strictEqual(game.getScore(room, "A"), 1);
        assert.strictEqual(room.solved.A["4A"], START_SEC + 100);
    });
});

describe("winner", () => {
    test("more problems solved wins", () => {
        const { room } = makeRunningGame();
        room.solved.A = { "4A": 100, "71A": 200 };
        room.solved.B = { "4A": 50 };
        assert.strictEqual(game.getWinner(room), "A");
    });

    test("0 - 0 is a draw", () => {
        const { room } = makeRunningGame();
        assert.strictEqual(game.getWinner(room), "DRAW");
    });

    test("same score: team that finished earlier wins", () => {
        const { room } = makeRunningGame();
        room.solved.A = { "4A": 100, "71A": 900 };
        room.solved.B = { "4A": 300, "1A": 500 };
        assert.strictEqual(game.getWinner(room), "B");
    });

    test("endGame only works once", () => {
        const { room } = makeRunningGame();
        assert.strictEqual(game.endGame(room), true);
        assert.strictEqual(room.status, "finished");
        assert.strictEqual(game.endGame(room), false);
    });

    test("isTimeUp", () => {
        const { room } = makeRunningGame(START_MS);
        assert.strictEqual(game.isTimeUp(room, room.endsAt - 1), false);
        assert.strictEqual(game.isTimeUp(room, room.endsAt), true);
    });
});

describe("disconnect and cleanup", () => {
    test("lobby player is removed only after the grace period", () => {
        const { room, bob } = makeLobby();
        game.markDisconnected(room, bob, 0);

        assert.strictEqual(game.removeGonePlayers(room, config.LOBBY_RECONNECT_GRACE_MS - 1), false);
        assert.strictEqual(room.players.length, 2);

        assert.strictEqual(game.removeGonePlayers(room, config.LOBBY_RECONNECT_GRACE_MS + 1), true);
        assert.strictEqual(room.players.length, 1);
    });

    test("players are kept during a running game", () => {
        const { room, bob } = makeRunningGame();
        game.markDisconnected(room, bob, 0);
        assert.strictEqual(game.removeGonePlayers(room, 10 * 60 * 1000), false);
        assert.strictEqual(room.players.length, 2);
    });

    test("reconnecting gives the player back their spot", () => {
        const { room, bob } = makeRunningGame();
        game.markDisconnected(room, bob, 0);
        game.markReconnected(room, bob, "new-socket");

        assert.strictEqual(bob.connected, true);
        assert.strictEqual(bob.socketId, "new-socket");
        assert.strictEqual(game.findPlayerByToken(room, bob.token), bob);
    });

    test("findPlayerByToken ignores empty tokens", () => {
        const { room } = makeLobby();
        assert.strictEqual(game.findPlayerByToken(room, ""), undefined);
    });

    test("room is deleted once everyone has been gone long enough", () => {
        const { room, alice, bob } = makeRunningGame();
        game.markDisconnected(room, alice, 0);
        assert.strictEqual(room.emptySince, null);

        game.markDisconnected(room, bob, 1000);
        assert.strictEqual(room.emptySince, 1000);
        assert.strictEqual(game.shouldDeleteRoom(room, 2000), false);
        assert.strictEqual(game.shouldDeleteRoom(room, 1000 + config.EMPTY_ROOM_TTL_MS + 1), true);
    });
});

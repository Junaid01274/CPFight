const crypto = require("crypto");
const config = require("./config");

const TEAMS = ["A", "B"];

function createRoom(roomId) {
    return {
        id: roomId,
        hostId: null,
        status: "lobby",
        startedAt: null,
        endsAt: null,
        winner: null,
        problems: [],
        players: [],
        solved: { A: {}, B: {} },
        teamMessages: { A: [], B: [] },
        disturbMessages: [],
        nextMessageId: 1,
        lastManualRefresh: 0,
        emptySince: null
    };
}

function createPlayer(socketId, username, cfUser) {
    return {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        socketId,
        connected: true,
        disconnectedAt: null,
        username,
        handle: cfUser.handle,
        rating: cfUser.rating || null,
        team: null,
        currentProblemId: null,
        codes: {},
        submissions: {},
        lastMessageAt: 0
    };
}

function findPlayer(room, playerId) {
    return room.players.find((player) => player.id === playerId);
}

function findPlayerByToken(room, token) {
    if (!token) {
        return undefined;
    }
    return room.players.find((player) => player.token === token);
}

function getTeamPlayers(room, team) {
    return room.players.filter((player) => player.team === team);
}

function hasProblem(room, problemId) {
    return room.problems.some((problem) => problem.id === problemId);
}

function countConnected(room) {
    return room.players.filter((player) => player.connected).length;
}

function canJoin(room) {
    if (!room) {
        return "Room does not exist";
    }
    if (room.status !== "lobby") {
        return "Game has already started";
    }
    if (room.players.length >= config.MAX_PLAYERS) {
        return "Room is full";
    }
    return null;
}

function addPlayer(room, player) {
    const error = canJoin(room);
    if (error) {
        return error;
    }

    const sameHandle = room.players.some(
        (p) => p.handle.toLowerCase() === player.handle.toLowerCase()
    );
    if (sameHandle) {
        return "This Codeforces handle is already in the room";
    }

    room.players.push(player);
    if (!room.hostId) {
        room.hostId = player.id;
    }
    room.emptySince = null;
    return null;
}

function removePlayer(room, playerId) {
    room.players = room.players.filter((player) => player.id !== playerId);

    if (room.hostId === playerId) {
        const nextHost =
            room.players.find((player) => player.connected) || room.players[0];
        room.hostId = nextHost ? nextHost.id : null;
    }
}

function joinTeam(room, player, team) {
    if (room.status !== "lobby") {
        return "Game has already started";
    }
    if (!TEAMS.includes(team)) {
        return "Invalid team";
    }
    if (player.team === team) {
        return null;
    }
    if (getTeamPlayers(room, team).length >= config.MAX_TEAM_SIZE) {
        return `Team ${team} is full`;
    }

    player.team = team;
    return null;
}

function startGame(room, player, problems, now = Date.now()) {
    if (room.hostId !== player.id) {
        return "Only the host can start the game";
    }
    if (room.status !== "lobby") {
        return "Game has already started";
    }
    if (getTeamPlayers(room, "A").length === 0) {
        return "Team A needs at least one player";
    }
    if (getTeamPlayers(room, "B").length === 0) {
        return "Team B needs at least one player";
    }
    if (problems.length === 0) {
        return "There are no problems to play with";
    }

    for (const p of room.players) {
        if (!p.team) {
            const sizeA = getTeamPlayers(room, "A").length;
            const sizeB = getTeamPlayers(room, "B").length;
            p.team = sizeA <= sizeB ? "A" : "B";
        }
    }

    room.problems = problems;
    room.status = "running";
    room.startedAt = now;
    room.endsAt = now + config.GAME_DURATION_MS;
    room.winner = null;
    return null;
}

function selectProblem(room, player, problemId) {
    if (room.status !== "running" || !hasProblem(room, problemId)) {
        return false;
    }
    player.currentProblemId = problemId;
    return true;
}

function updateCode(room, player, problemId, code) {
    if (room.status !== "running" || !player.team) {
        return "Game is not running";
    }
    if (!hasProblem(room, problemId)) {
        return "Invalid problem";
    }
    if (typeof code !== "string") {
        return "Invalid code";
    }
    if (code.length > config.MAX_CODE_LENGTH) {
        return "Code is too long to share";
    }

    player.codes[problemId] = code;
    return null;
}

function makeMessage(room, player, text, now) {
    text = text.substring(0, config.MAX_MESSAGE_LENGTH);

    if (!text || !player.team) {
        return null;
    }
    if (now - player.lastMessageAt < config.CHAT_COOLDOWN_MS) {
        return null;
    }
    player.lastMessageAt = now;

    return {
        id: room.nextMessageId++,
        username: player.username,
        team: player.team,
        message: text,
        time: now
    };
}

function pushAndTrim(list, item) {
    list.push(item);
    if (list.length > config.MAX_MESSAGES) {
        list.shift();
    }
}

function addTeamMessage(room, player, text, now = Date.now()) {
    const message = makeMessage(room, player, text, now);
    if (message) {
        pushAndTrim(room.teamMessages[player.team], message);
    }
    return message;
}

function addDisturbMessage(room, player, text, now = Date.now()) {
    const message = makeMessage(room, player, text, now);
    if (message) {
        pushAndTrim(room.disturbMessages, message);
    }
    return message;
}

function applySubmissions(room, player, cfSubmissions) {
    if (room.status !== "running" || !player.team) {
        return false;
    }

    // codeforces gives seconds, Date.now() is milliseconds
    const startSec = Math.floor(room.startedAt / 1000);
    const endSec = Math.floor(room.endsAt / 1000);
    const teamSolved = room.solved[player.team];
    let changed = false;

    for (const problem of room.problems) {
        const attempts = cfSubmissions.filter(
            (s) =>
                s.problem &&
                s.problem.contestId === problem.contestId &&
                s.problem.index === problem.index &&
                s.creationTimeSeconds >= startSec &&
                s.creationTimeSeconds <= endSec
        );

        if (attempts.length === 0) {
            continue;
        }

        const latest = attempts[0];
        const newStatus = {
            id: latest.id,
            verdict: latest.verdict || "TESTING",
            language: latest.programmingLanguage,
            time: latest.creationTimeSeconds
        };
        const oldStatus = player.submissions[problem.id];

        if (
            !oldStatus ||
            oldStatus.id !== newStatus.id ||
            oldStatus.verdict !== newStatus.verdict
        ) {
            player.submissions[problem.id] = newStatus;
            changed = true;
        }

        const accepted = attempts.filter((s) => s.verdict === "OK");
        if (accepted.length > 0) {
            const firstAcTime = accepted[accepted.length - 1].creationTimeSeconds;
            const oldTime = teamSolved[problem.id];

            if (oldTime === undefined || firstAcTime < oldTime) {
                teamSolved[problem.id] = firstAcTime;
                changed = true;
                console.log(`Team ${player.team} solved ${problem.name} in ${room.id}`);
            }
        }
    }

    return changed;
}

function getScore(room, team) {
    return Object.keys(room.solved[team]).length;
}

function getWinner(room) {
    const scoreA = getScore(room, "A");
    const scoreB = getScore(room, "B");

    if (scoreA !== scoreB) {
        return scoreA > scoreB ? "A" : "B";
    }
    if (scoreA === 0) {
        return "DRAW";
    }

    const lastA = Math.max(...Object.values(room.solved.A));
    const lastB = Math.max(...Object.values(room.solved.B));

    if (lastA < lastB) {
        return "A";
    }
    if (lastB < lastA) {
        return "B";
    }
    return "DRAW";
}

function isTimeUp(room, now = Date.now()) {
    return room.status === "running" && now >= room.endsAt;
}

function endGame(room) {
    if (room.status !== "running") {
        return false;
    }
    room.status = "finished";
    room.winner = getWinner(room);
    return true;
}

function markDisconnected(room, player, now = Date.now()) {
    player.connected = false;
    player.disconnectedAt = now;

    if (countConnected(room) === 0) {
        room.emptySince = now;
    }
}

function markReconnected(room, player, socketId) {
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    room.emptySince = null;
}

function removeGonePlayers(room, now = Date.now()) {
    if (room.status !== "lobby") {
        return false;
    }

    const gone = room.players.filter(
        (p) =>
            !p.connected &&
            now - p.disconnectedAt > config.LOBBY_RECONNECT_GRACE_MS
    );

    for (const player of gone) {
        removePlayer(room, player.id);
    }
    return gone.length > 0;
}

function shouldDeleteRoom(room, now = Date.now()) {
    if (room.players.length === 0) {
        return true;
    }
    return (
        room.emptySince !== null &&
        now - room.emptySince > config.EMPTY_ROOM_TTL_MS
    );
}

module.exports = {
    createRoom,
    createPlayer,
    findPlayer,
    findPlayerByToken,
    getTeamPlayers,
    countConnected,
    canJoin,
    addPlayer,
    removePlayer,
    joinTeam,
    startGame,
    selectProblem,
    updateCode,
    addTeamMessage,
    addDisturbMessage,
    applySubmissions,
    getScore,
    getWinner,
    isTimeUp,
    endGame,
    markDisconnected,
    markReconnected,
    removeGonePlayers,
    shouldDeleteRoom
};

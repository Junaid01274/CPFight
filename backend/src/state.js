const config = require("./config");
const { getScore } = require("./room");

function publicPlayer(player) {
    return {
        id: player.id,
        username: player.username,
        handle: player.handle,
        rating: player.rating,
        team: player.team,
        currentProblemId: player.currentProblemId,
        connected: player.connected
    };
}

function getTeamSubmission(room, team, problemId) {
    let latest = null;

    for (const player of room.players) {
        if (player.team !== team) {
            continue;
        }

        const submission = player.submissions[problemId];
        if (submission && (!latest || submission.time > latest.time)) {
            latest = {
                ...submission,
                username: player.username,
                handle: player.handle
            };
        }
    }

    return latest;
}

// each player gets their own copy, so the other team's code and chat are never sent
function buildStateFor(room, player, now = Date.now()) {
    const myTeam = player.team;

    const teamCodes = {};
    if (myTeam) {
        for (const mate of room.players) {
            if (mate.team === myTeam && mate.id !== player.id) {
                teamCodes[mate.id] = {
                    username: mate.username,
                    currentProblemId: mate.currentProblemId,
                    codes: mate.codes
                };
            }
        }
    }

    const submissions = {};
    for (const problem of room.problems) {
        submissions[problem.id] = {
            A: getTeamSubmission(room, "A", problem.id),
            B: getTeamSubmission(room, "B", problem.id)
        };
    }

    return {
        roomId: room.id,
        hostId: room.hostId,
        status: room.status,
        startedAt: room.startedAt,
        endsAt: room.endsAt,
        serverTime: now,
        winner: room.winner,
        settings: {
            maxTeamSize: config.MAX_TEAM_SIZE,
            gameMinutes: config.GAME_DURATION_MS / 60000,
            problemCount: config.PROBLEMS_PER_GAME
        },
        players: room.players.map(publicPlayer),
        problems: room.problems,
        scores: {
            A: getScore(room, "A"),
            B: getScore(room, "B")
        },
        solved: room.solved,
        submissions,
        myTeam,
        me: {
            ...publicPlayer(player),
            codes: player.codes
        },
        teamCodes,
        teamMessages: myTeam ? room.teamMessages[myTeam] : [],
        disturbMessages: room.disturbMessages
    };
}

module.exports = {
    buildStateFor
};

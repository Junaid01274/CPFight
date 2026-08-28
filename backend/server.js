const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

const GAME_DURATION = 30 * 60; // 30 minutes

// =====================================================
// EXPRESS
// =====================================================

app.use(
    cors({
        origin: FRONTEND_URL
    })
);

app.use(express.json());

app.get("/", (req, res) => {
    res.send("CF Battle Backend Running");
});

// =====================================================
// SOCKET.IO
// =====================================================

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL
    }
});

// =====================================================
// LOAD PROBLEMS
// =====================================================

const problemsPath = path.join(
    __dirname,
    "problems.json"
);

let problems = [];

try {
    problems = JSON.parse(
        fs.readFileSync(
            problemsPath,
            "utf-8"
        )
    );

    console.log(
        `Loaded ${problems.length} problems`
    );
} catch (error) {
    console.log(
        "Could not load problems.json"
    );

    process.exit(1);
}

// =====================================================
// ROOMS
// =====================================================

const rooms = {};

// =====================================================
// ROOM HELPERS
// =====================================================

function generateRoomId() {
    let roomId;

    do {
        roomId = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();
    } while (rooms[roomId]);

    return roomId;
}

function getPlayer(room, socketId) {
    return room.players.find(
        (player) =>
            player.id === socketId
    );
}

function getTeamPlayers(room, team) {
    return room.players.filter(
        (player) =>
            player.team === team
    );
}

function isTeamFull(room, team) {
    return (
        getTeamPlayers(
            room,
            team
        ).length >= 3
    );
}

function getProblemById(problemId) {
    return problems.find(
        (problem) =>
            problem.id === problemId
    );
}

function getScore(room, team) {
    return room.solved[team].size;
}

function getWinner(room) {
    const scoreA =
        getScore(room, "A");

    const scoreB =
        getScore(room, "B");

    if (scoreA > scoreB) {
        return "A";
    }

    if (scoreB > scoreA) {
        return "B";
    }

    return "DRAW";
}

// =====================================================
// RANDOM PROBLEMS
// =====================================================

function getRandomProblems(count) {
    const available = [...problems];

    for (
        let i = available.length - 1;
        i > 0;
        i--
    ) {
        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [
            available[i],
            available[j]
        ] = [
            available[j],
            available[i]
        ];
    }

    return available.slice(
        0,
        Math.min(
            count,
            available.length
        )
    );
}

// =====================================================
// PUBLIC PROBLEM DATA
// =====================================================

function getPublicProblems(room) {
    return room.problems.map(
        (problem) => ({
            id:
                problem.id,

            contestId:
                problem.contestId,

            index:
                problem.index,

            name:
                problem.name,

            rating:
                problem.rating,

            tags:
                problem.tags,

            statement:
                problem.statement,

            input:
                problem.input,

            output:
                problem.output,

            codeforcesUrl:
                problem.codeforcesUrl,

            submitUrl:
                problem.submitUrl
        })
    );
}

// =====================================================
// SUBMISSION HELPERS
// =====================================================

function getProblemSubmission(
    room,
    team,
    problemId
) {
    for (
        const player of room.players
    ) {
        if (
            player.team !== team
        ) {
            continue;
        }

        const submission =
            player.submissions[
                problemId
            ];

        if (submission) {
            return {
                ...submission,

                username:
                    player.username,

                handle:
                    player.handle
            };
        }
    }

    return null;
}

function getSubmissionStatus(
    room,
    problemId
) {
    return {
        A:
            getProblemSubmission(
                room,
                "A",
                problemId
            ),

        B:
            getProblemSubmission(
                room,
                "B",
                problemId
            )
    };
}

// =====================================================
// BUILD CLIENT STATE
// =====================================================

function buildState(
    room,
    socketId
) {
    const currentPlayer =
        getPlayer(
            room,
            socketId
        );

    if (!currentPlayer) {
        return null;
    }

    const myTeam =
        currentPlayer.team;

    const teamCodes = {};

    for (
        const player of room.players
    ) {
        if (
            player.team === myTeam &&
            player.id !== socketId
        ) {
            teamCodes[
                player.id
            ] = {
                username:
                    player.username,

                currentProblemId:
                    player.currentProblemId,

                codes:
                    player.codes
            };
        }
    }

    const submissions = {};

    for (
        const problem of room.problems
    ) {
        submissions[
            problem.id
        ] =
            getSubmissionStatus(
                room,
                problem.id
            );
    }

    let timeRemaining = null;

    if (
        room.status ===
            "running" &&
        room.startedAt
    ) {
        const elapsed =
            Math.floor(
                (Date.now() -
                    room.startedAt) /
                    1000
            );

        timeRemaining =
            Math.max(
                0,
                GAME_DURATION -
                    elapsed
            );
    }

    return {
        roomId:
            room.id,

        hostId:
            room.hostId,

        status:
            room.status,

        startedAt:
            room.startedAt,

        timeRemaining,

        winner:
            room.winner,

        players:
            room.players.map(
                (player) => ({
                    id:
                        player.id,

                    username:
                        player.username,

                    handle:
                        player.handle,

                    rating:
                        player.rating,

                    team:
                        player.team,

                    currentProblemId:
                        player.currentProblemId
                })
            ),

        problems:
            getPublicProblems(room),

        scores: {
            A:
                getScore(room, "A"),

            B:
                getScore(room, "B")
        },

        solved: {
            A:
                [...room.solved.A],

            B:
                [...room.solved.B]
        },

        submissions,

        myTeam,

        myPlayer: {
            id:
                currentPlayer.id,

            username:
                currentPlayer.username,

            handle:
                currentPlayer.handle,

            rating:
                currentPlayer.rating,

            team:
                currentPlayer.team,

            currentProblemId:
                currentPlayer.currentProblemId,

            codes:
                currentPlayer.codes
        },

        teamCodes,

        teamMessages:
            myTeam
                ? room.teamMessages[
                    myTeam
                ]
                : [],

        disturbMessages:
            room.disturbMessages
    };
}

// =====================================================
// SEND STATE
// =====================================================

function sendRoomState(room) {
    for (
        const player of room.players
    ) {
        const state =
            buildState(
                room,
                player.id
            );

        if (state) {
            io.to(
                player.id
            ).emit(
                "roomState",
                state
            );
        }
    }
}

// =====================================================
// END GAME
// =====================================================

function endGame(room) {
    if (
        room.status !==
        "running"
    ) {
        return;
    }

    room.status = "finished";

    room.winner =
        getWinner(room);

    console.log(
        `Game ended in ${room.id}`
    );

    console.log(
        `Winner: ${room.winner}`
    );

    sendRoomState(room);
}

// =====================================================
// CODEFORCES HANDLE VALIDATION
// =====================================================

async function validateCodeforcesHandle(
    handle
) {
    try {
        const url =
            "https://codeforces.com/api/user.info" +
            `?handles=${encodeURIComponent(
                handle
            )}`;

        const response =
            await fetch(url);

        if (
            !response.ok
        ) {
            return null;
        }

        const data =
            await response.json();

        if (
            data.status !==
                "OK" ||
            !data.result ||
            data.result.length ===
                0
        ) {
            return null;
        }

        return data.result[0];
    } catch (error) {
        console.log(
            "Handle validation error:",
            error.message
        );

        return null;
    }
}

// =====================================================
// UPDATE SUBMISSIONS
// =====================================================

async function updateSubmissions(room) {
    if (
        room.status !==
        "running"
    ) {
        return;
    }

    let changed = false;

    for (
        const player of room.players
    ) {
        if (
            !player.handle ||
            !player.team
        ) {
            continue;
        }

        try {
            const url =
                "https://codeforces.com/api/user.status" +
                `?handle=${encodeURIComponent(
                    player.handle
                )}` +
                "&from=1&count=50";

            const response =
                await fetch(url);

            if (
                !response.ok
            ) {
                continue;
            }

            const data =
                await response.json();

            if (
                data.status !==
                "OK"
            ) {
                continue;
            }

            for (
                const problem of room.problems
            ) {
                const problemId =
                    problem.id;

                const submission =
                    data.result.find(
                        (item) => {
                            if (
                                !item.problem
                            ) {
                                return false;
                            }

                            return (
                                item.problem
                                    .contestId ===
                                    problem.contestId &&
                                item.problem
                                    .index ===
                                    problem.index &&
                                item.creationTimeSeconds >=
                                    room.startedAt
                            );
                        }
                    );

                if (
                    !submission
                ) {
                    continue;
                }

                const newStatus = {
                    id:
                        submission.id,

                    verdict:
                        submission.verdict ||
                        "TESTING",

                    language:
                        submission.programmingLanguage,

                    time:
                        submission.creationTimeSeconds
                };

                const oldStatus =
                    player.submissions[
                        problemId
                    ];

                if (
                    !oldStatus ||
                    oldStatus.id !==
                        newStatus.id ||
                    oldStatus.verdict !==
                        newStatus.verdict
                ) {
                    player.submissions[
                        problemId
                    ] =
                        newStatus;

                    changed = true;

                    console.log(
                        `${player.handle} - ` +
                        `${problem.name}: ` +
                        `${newStatus.verdict}`
                    );
                }

                if (
                    submission.verdict ===
                        "OK" &&
                    !room.solved[
                        player.team
                    ].has(
                        problemId
                    )
                ) {
                    room.solved[
                        player.team
                    ].add(
                        problemId
                    );

                    changed = true;

                    console.log(
                        `Team ${player.team} solved ${problem.name}`
                    );
                }
            }
        } catch (error) {
            console.log(
                `Submission check failed for ${player.handle}`
            );
        }
    }

    if (changed) {
        sendRoomState(room);
    }
}

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    (socket) => {
        console.log(
            "User connected:",
            socket.id
        );

        // =================================================
        // CREATE ROOM
        // =================================================

        socket.on(
            "createRoom",
            async ({
                username,
                handle
            }) => {
                username =
                    String(
                        username || ""
                    ).trim();

                handle =
                    String(
                        handle || ""
                    ).trim();

                if (
                    !username ||
                    !handle
                ) {
                    socket.emit(
                        "errorMessage",
                        "Username and Codeforces handle are required"
                    );

                    return;
                }

                const cfUser =
                    await validateCodeforcesHandle(
                        handle
                    );

                if (!cfUser) {
                    socket.emit(
                        "errorMessage",
                        "Invalid Codeforces handle"
                    );

                    return;
                }

                const roomId =
                    generateRoomId();

                rooms[roomId] = {
                    id:
                        roomId,

                    hostId:
                        socket.id,

                    status:
                        "lobby",

                    startedAt:
                        null,

                    winner:
                        null,

                    problems:
                        [],

                    players: [
                        {
                            id:
                                socket.id,

                            username,

                            handle:
                                cfUser.handle,

                            rating:
                                cfUser.rating ||
                                null,

                            team:
                                null,

                            currentProblemId:
                                null,

                            codes:
                                {},

                            submissions:
                                {}
                        }
                    ],

                    solved: {
                        A:
                            new Set(),

                        B:
                            new Set()
                    },

                    teamMessages: {
                        A: [],

                        B: []
                    },

                    disturbMessages:
                        []
                };

                socket.join(
                    roomId
                );

                socket.emit(
                    "roomCreated",
                    roomId
                );

                sendRoomState(
                    rooms[roomId]
                );

                console.log(
                    `Room created: ${roomId}`
                );
            }
        );

        // =================================================
        // JOIN ROOM
        // =================================================

        socket.on(
            "joinRoom",
            async ({
                roomId,
                username,
                handle
            }) => {
                roomId =
                    String(
                        roomId || ""
                    )
                        .trim()
                        .toUpperCase();

                username =
                    String(
                        username || ""
                    ).trim();

                handle =
                    String(
                        handle || ""
                    ).trim();

                const room =
                    rooms[roomId];

                if (!room) {
                    socket.emit(
                        "errorMessage",
                        "Room does not exist"
                    );

                    return;
                }

                if (
                    room.status !==
                    "lobby"
                ) {
                    socket.emit(
                        "errorMessage",
                        "Game has already started"
                    );

                    return;
                }

                if (
                    room.players.length >=
                    6
                ) {
                    socket.emit(
                        "errorMessage",
                        "Room is full"
                    );

                    return;
                }

                if (
                    !username ||
                    !handle
                ) {
                    socket.emit(
                        "errorMessage",
                        "Username and Codeforces handle are required"
                    );

                    return;
                }

                const cfUser =
                    await validateCodeforcesHandle(
                        handle
                    );

                if (!cfUser) {
                    socket.emit(
                        "errorMessage",
                        "Invalid Codeforces handle"
                    );

                    return;
                }

                const duplicate =
                    room.players.some(
                        (player) =>
                            player.handle.toLowerCase() ===
                            cfUser.handle.toLowerCase()
                    );

                if (duplicate) {
                    socket.emit(
                        "errorMessage",
                        "This Codeforces handle is already in the room"
                    );

                    return;
                }

                room.players.push(
                    {
                        id:
                            socket.id,

                        username,

                        handle:
                            cfUser.handle,

                        rating:
                            cfUser.rating ||
                            null,

                        team:
                            null,

                        currentProblemId:
                            null,

                        codes:
                            {},

                        submissions:
                            {}
                    }
                );

                socket.join(
                    roomId
                );

                sendRoomState(
                    room
                );

                console.log(
                    `${username} joined ${roomId}`
                );
            }
        );

        // =================================================
        // JOIN TEAM
        // =================================================

        socket.on(
            "joinTeam",
            ({
                roomId,
                team
            }) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                const player =
                    getPlayer(
                        room,
                        socket.id
                    );

                if (!player) {
                    return;
                }

                if (
                    room.status !==
                    "lobby"
                ) {
                    socket.emit(
                        "errorMessage",
                        "Game has already started"
                    );

                    return;
                }

                if (
                    team !== "A" &&
                    team !== "B"
                ) {
                    return;
                }

                if (
                    player.team ===
                    team
                ) {
                    return;
                }

                if (
                    isTeamFull(
                        room,
                        team
                    )
                ) {
                    socket.emit(
                        "errorMessage",
                        `Team ${team} is full`
                    );

                    return;
                }

                player.team =
                    team;

                sendRoomState(
                    room
                );
            }
        );

        // =================================================
        // START GAME
        // =================================================

        socket.on(
            "startGame",
            (roomId) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                if (
                    room.hostId !==
                    socket.id
                ) {
                    socket.emit(
                        "errorMessage",
                        "Only the host can start the game"
                    );

                    return;
                }

                if (
                    room.status !==
                    "lobby"
                ) {
                    return;
                }

                const teamA =
                    getTeamPlayers(
                        room,
                        "A"
                    );

                const teamB =
                    getTeamPlayers(
                        room,
                        "B"
                    );

                if (
                    teamA.length ===
                    0
                ) {
                    socket.emit(
                        "errorMessage",
                        "Team A needs at least one player"
                    );

                    return;
                }

                if (
                    teamB.length ===
                    0
                ) {
                    socket.emit(
                        "errorMessage",
                        "Team B needs at least one player"
                    );

                    return;
                }

                /*
                 * Server selects problems.
                 */
                room.problems =
                    getRandomProblems(
                        6
                    );

                room.status =
                    "running";

                room.startedAt =
                    Date.now();

                room.winner =
                    null;

                sendRoomState(
                    room
                );

                console.log(
                    `Game started: ${roomId}`
                );
            }
        );

        // =================================================
        // SELECT PROBLEM
        // =================================================

        socket.on(
            "selectProblem",
            ({
                roomId,
                problemId
            }) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                const player =
                    getPlayer(
                        room,
                        socket.id
                    );

                if (!player) {
                    return;
                }

                if (
                    room.status !==
                    "running"
                ) {
                    return;
                }

                const problemExists =
                    room.problems.some(
                        (problem) =>
                            problem.id ===
                            problemId
                    );

                if (
                    !problemExists
                ) {
                    return;
                }

                player.currentProblemId =
                    problemId;

                sendRoomState(
                    room
                );
            }
        );

        // =================================================
        // CODE UPDATE
        // =================================================

        socket.on(
            "codeUpdate",
            ({
                roomId,
                problemId,
                code
            }) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                const player =
                    getPlayer(
                        room,
                        socket.id
                    );

                if (
                    !player ||
                    !player.team
                ) {
                    return;
                }

                if (
                    room.status !==
                    "running"
                ) {
                    return;
                }

                const problemExists =
                    room.problems.some(
                        (problem) =>
                            problem.id ===
                            problemId
                    );

                if (
                    !problemExists
                ) {
                    return;
                }

                player.codes[
                    problemId
                ] =
                    String(
                        code || ""
                    );

                /*
                 * Send code only to
                 * teammates.
                 */
                const teammates =
                    getTeamPlayers(
                        room,
                        player.team
                    );

                for (
                    const teammate of teammates
                ) {
                    io.to(
                        teammate.id
                    ).emit(
                        "teamCodeUpdate",
                        {
                            playerId:
                                player.id,

                            username:
                                player.username,

                            problemId,

                            code:
                                player.codes[
                                    problemId
                                ]
                        }
                    );
                }
            }
        );

        // =================================================
        // TEAM CHAT
        // =================================================

        socket.on(
            "sendTeamMessage",
            ({
                roomId,
                message
            }) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                const player =
                    getPlayer(
                        room,
                        socket.id
                    );

                if (
                    !player ||
                    !player.team
                ) {
                    return;
                }

                message =
                    String(
                        message || ""
                    )
                        .trim()
                        .substring(
                            0,
                            500
                        );

                if (!message) {
                    return;
                }

                room.teamMessages[
                    player.team
                ].push(
                    {
                        id:
                            Date.now() +
                            Math.random(),

                        username:
                            player.username,

                        message,

                        time:
                            Date.now()
                    }
                );

                if (
                    room.teamMessages[
                        player.team
                    ].length >
                    100
                ) {
                    room.teamMessages[
                        player.team
                    ].shift();
                }

                const teammates =
                    getTeamPlayers(
                        room,
                        player.team
                    );

                for (
                    const teammate of teammates
                ) {
                    const state =
                        buildState(
                            room,
                            teammate.id
                        );

                    io.to(
                        teammate.id
                    ).emit(
                        "roomState",
                        state
                    );
                }
            }
        );

        // =================================================
        // DISTURB CHAT
        // =================================================

        socket.on(
            "sendDisturbMessage",
            ({
                roomId,
                message
            }) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                const player =
                    getPlayer(
                        room,
                        socket.id
                    );

                if (
                    !player ||
                    !player.team
                ) {
                    return;
                }

                message =
                    String(
                        message || ""
                    )
                        .trim()
                        .substring(
                            0,
                            500
                        );

                if (!message) {
                    return;
                }

                room.disturbMessages.push(
                    {
                        id:
                            Date.now() +
                            Math.random(),

                        username:
                            player.username,

                        team:
                            player.team,

                        message,

                        time:
                            Date.now()
                    }
                );

                if (
                    room.disturbMessages
                        .length >
                    100
                ) {
                    room.disturbMessages.shift();
                }

                sendRoomState(
                    room
                );
            }
        );

        // =================================================
        // MANUAL SUBMISSION REFRESH
        // =================================================

        socket.on(
            "refreshSubmissions",
            async (roomId) => {
                const room =
                    rooms[roomId];

                if (!room) {
                    return;
                }

                await updateSubmissions(
                    room
                );
            }
        );

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            () => {
                console.log(
                    "User disconnected:",
                    socket.id
                );

                for (
                    const roomId in rooms
                ) {
                    const room =
                        rooms[roomId];

                    const playerIndex =
                        room.players.findIndex(
                            (player) =>
                                player.id ===
                                socket.id
                        );

                    if (
                        playerIndex ===
                        -1
                    ) {
                        continue;
                    }

                    const wasHost =
                        room.hostId ===
                        socket.id;

                    room.players.splice(
                        playerIndex,
                        1
                    );

                    if (
                        room.players.length ===
                        0
                    ) {
                        delete rooms[
                            roomId
                        ];

                        continue;
                    }

                    if (wasHost) {
                        room.hostId =
                            room.players[0].id;
                    }

                    sendRoomState(
                        room
                    );
                }
            }
        );
    }
);

// =====================================================
// TIMER CHECK
// =====================================================

setInterval(
    () => {
        for (
            const roomId in rooms
        ) {
            const room =
                rooms[roomId];

            if (
                room.status !==
                    "running" ||
                !room.startedAt
            ) {
                continue;
            }

            const elapsed =
                Math.floor(
                    (Date.now() -
                        room.startedAt) /
                        1000
                );

            if (
                elapsed >=
                GAME_DURATION
            ) {
                endGame(room);
            } else {
                /*
                 * Send updated timer.
                 */
                sendRoomState(
                    room
                );
            }
        }
    },
    1000
);

// =====================================================
// SUBMISSION CHECK
// =====================================================

setInterval(
    async () => {
        for (
            const roomId in rooms
        ) {
            const room =
                rooms[roomId];

            if (
                room.status ===
                "running"
            ) {
                await updateSubmissions(
                    room
                );
            }
        }
    },
    10000
);

// =====================================================
// START SERVER
// =====================================================

server.listen(
    PORT,
    () => {
        console.log("");
        console.log(
            "===================================="
        );

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            `Loaded problems: ${problems.length}`
        );

        console.log(
            `Game duration: ${GAME_DURATION / 60} minutes`
        );

        console.log(
            "===================================="
        );
    }
);
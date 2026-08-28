import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import socket from "./socket";

function formatTime(seconds) {
    if (seconds === null || seconds === undefined) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}

function App() {
    const [page, setPage] = useState("home");

    const [username, setUsername] = useState("");
    const [handle, setHandle] = useState("");
    const [roomInput, setRoomInput] = useState("");

    const [roomId, setRoomId] = useState("");
    const [room, setRoom] = useState(null);

    const [selectedProblem, setSelectedProblem] = useState(null);
    const [myCode, setMyCode] = useState("");

    const [teamMessage, setTeamMessage] = useState("");
    const [disturbMessage, setDisturbMessage] = useState("");

    const [error, setError] = useState("");

    /*
     * Stores the latest code of teammates.
     *
     * {
     *   playerId: {
     *      username: "Ali",
     *      currentProblemId: "71A",
     *      codes: {
     *          "71A": "...",
     *          "4A": "..."
     *      }
     *   }
     * }
     */
    const [teammateCodes, setTeammateCodes] = useState({});

    /*
     * Currently selected teammate whose
     * code we want to watch.
     */
    const [selectedTeammate, setSelectedTeammate] =
        useState(null);

    // =====================================================
    // SOCKET EVENTS
    // =====================================================

    useEffect(() => {
        socket.on("roomCreated", (newRoomId) => {
            setRoomId(newRoomId);
            setPage("lobby");
            setError("");
        });

        socket.on("roomState", (newRoom) => {
            setRoom(newRoom);
            setRoomId(newRoom.roomId);

            if (newRoom.status === "lobby") {
                setPage("lobby");
            }

            if (
                newRoom.status === "running" ||
                newRoom.status === "finished"
            ) {
                setPage("game");
            }

            /*
             * Update teammate code received
             * from the server.
             */
            if (newRoom.teamCodes) {
                setTeammateCodes(newRoom.teamCodes);
            }

            /*
             * Update currently selected problem.
             */
            const currentProblemId =
                newRoom.myPlayer?.currentProblemId;

            if (currentProblemId) {
                const problem =
                    newRoom.problems.find(
                        (p) =>
                            p.id === currentProblemId
                    );

                if (problem) {
                    setSelectedProblem(
                        problem
                    );

                    setMyCode(
                        newRoom.myPlayer.codes?.[
                            currentProblemId
                        ] || ""
                    );
                }
            }
        });

        /*
         * Receive live code updates
         * from teammates.
         */
        socket.on("teamCodeUpdate", (data) => {
            setTeammateCodes((previous) => {
                const updated = {
                    ...previous
                };

                if (!updated[data.playerId]) {
                    updated[data.playerId] = {
                        username:
                            data.username,

                        currentProblemId:
                            data.problemId,

                        codes: {}
                    };
                }

                updated[data.playerId] = {
                    ...updated[data.playerId],

                    username:
                        data.username,

                    currentProblemId:
                        data.problemId,

                    codes: {
                        ...updated[
                            data.playerId
                        ].codes,

                        [data.problemId]:
                            data.code
                    }
                };

                return updated;
            });
        });

        socket.on("errorMessage", (message) => {
            setError(message);
        });

        return () => {
            socket.off("roomCreated");
            socket.off("roomState");
            socket.off("teamCodeUpdate");
            socket.off("errorMessage");
        };
    }, []);

    // =====================================================
    // CREATE ROOM
    // =====================================================

    function createRoom() {
        setError("");

        if (!username.trim()) {
            setError("Enter username");
            return;
        }

        if (!handle.trim()) {
            setError("Enter Codeforces handle");
            return;
        }

        socket.emit("createRoom", {
            username: username.trim(),
            handle: handle.trim()
        });
    }

    // =====================================================
    // JOIN ROOM
    // =====================================================

    function joinRoom() {
        setError("");

        if (!username.trim()) {
            setError("Enter username");
            return;
        }

        if (!handle.trim()) {
            setError("Enter Codeforces handle");
            return;
        }

        if (!roomInput.trim()) {
            setError("Enter room ID");
            return;
        }

        const id =
            roomInput
                .trim()
                .toUpperCase();

        socket.emit("joinRoom", {
            roomId: id,
            username: username.trim(),
            handle: handle.trim()
        });

        setRoomId(id);
    }

    // =====================================================
    // JOIN TEAM
    // =====================================================

    function chooseTeam(team) {
        setError("");

        socket.emit("joinTeam", {
            roomId,
            team
        });
    }

    // =====================================================
    // START GAME
    // =====================================================

    function startGame() {
        setError("");

        socket.emit(
            "startGame",
            roomId
        );
    }

    // =====================================================
    // SELECT PROBLEM
    // =====================================================

    function chooseProblem(problem) {
        setSelectedProblem(problem);

        setSelectedTeammate(null);

        setMyCode(
            room.myPlayer.codes?.[
                problem.id
            ] || ""
        );

        socket.emit(
            "selectProblem",
            {
                roomId,
                problemId: problem.id
            }
        );
    }

    // =====================================================
    // CHANGE MY CODE
    // =====================================================

    function changeCode(value) {
        const code = value || "";

        setMyCode(code);

        if (!selectedProblem) {
            return;
        }

        socket.emit(
            "codeUpdate",
            {
                roomId,
                problemId:
                    selectedProblem.id,
                code
            }
        );
    }

    // =====================================================
    // TEAM CHAT
    // =====================================================

    function sendTeamChat() {
        const message =
            teamMessage.trim();

        if (!message) {
            return;
        }

        socket.emit(
            "sendTeamMessage",
            {
                roomId,
                message
            }
        );

        setTeamMessage("");
    }

    // =====================================================
    // DISTURB CHAT
    // =====================================================

    function sendDisturbChat() {
        const message =
            disturbMessage.trim();

        if (!message) {
            return;
        }

        socket.emit(
            "sendDisturbMessage",
            {
                roomId,
                message
            }
        );

        setDisturbMessage("");
    }

    // =====================================================
    // REFRESH SUBMISSIONS
    // =====================================================

    function refreshSubmissions() {
        socket.emit(
            "refreshSubmissions",
            roomId
        );
    }

    // =====================================================
    // FIND PROBLEM
    // =====================================================

    function findProblem(problemId) {
        if (!room) {
            return null;
        }

        return room.problems.find(
            (problem) =>
                problem.id === problemId
        );
    }

    // =====================================================
    // FIND PROBLEM NAME
    // =====================================================

    function getProblemName(problemId) {
        const problem =
            findProblem(problemId);

        return problem
            ? problem.name
            : "No problem selected";
    }

    // =====================================================
    // HOME
    // =====================================================

    if (page === "home") {
        return (
            <div className="container">

                <h1>CF Battle</h1>

                <div className="card">

                    <h2>
                        Create / Join Room
                    </h2>

                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) =>
                            setUsername(
                                e.target.value
                            )
                        }
                    />

                    <input
                        type="text"
                        placeholder="Codeforces Handle"
                        value={handle}
                        onChange={(e) =>
                            setHandle(
                                e.target.value
                            )
                        }
                    />

                    <button
                        onClick={
                            createRoom
                        }
                    >
                        Create Room
                    </button>

                    <hr />

                    <input
                        type="text"
                        placeholder="Room ID"
                        value={roomInput}
                        onChange={(e) =>
                            setRoomInput(
                                e.target.value
                            )
                        }
                    />

                    <button
                        onClick={
                            joinRoom
                        }
                    >
                        Join Room
                    </button>

                    {error && (
                        <p className="error">
                            {error}
                        </p>
                    )}

                </div>

            </div>
        );
    }

    // =====================================================
    // LOBBY
    // =====================================================

    if (
        page === "lobby" &&
        room
    ) {
        const teamA =
            room.players.filter(
                (player) =>
                    player.team === "A"
            );

        const teamB =
            room.players.filter(
                (player) =>
                    player.team === "B"
            );

        const unassigned =
            room.players.filter(
                (player) =>
                    player.team === null
            );

        const isHost =
            room.hostId ===
            room.myPlayer.id;

        return (
            <div className="container">

                <h1>
                    CF Battle
                </h1>

                <h2>
                    Room:{" "}
                    {room.roomId}
                </h2>

                {error && (
                    <p className="error">
                        {error}
                    </p>
                )}

                <div className="teams">

                    {/* TEAM A */}

                    <div className="card">

                        <h2>
                            Team A
                        </h2>

                        {teamA.length ===
                            0 && (
                            <p>
                                No players yet
                            </p>
                        )}

                        {teamA.map(
                            (player) => (
                                <p
                                    key={
                                        player.id
                                    }
                                >
                                    {
                                        player.username
                                    }{" "}
                                    (
                                    {
                                        player.handle
                                    }
                                    )
                                </p>
                            )
                        )}

                        <p>
                            Players:{" "}
                            {teamA.length}/3
                        </p>

                        <button
                            disabled={
                                teamA.length >=
                                    3 ||
                                room.myTeam ===
                                    "A"
                            }
                            onClick={() =>
                                chooseTeam(
                                    "A"
                                )
                            }
                        >
                            {room.myTeam ===
                            "A"
                                ? "You are in Team A"
                                : "Join Team A"}
                        </button>

                    </div>

                    {/* TEAM B */}

                    <div className="card">

                        <h2>
                            Team B
                        </h2>

                        {teamB.length ===
                            0 && (
                            <p>
                                No players yet
                            </p>
                        )}

                        {teamB.map(
                            (player) => (
                                <p
                                    key={
                                        player.id
                                    }
                                >
                                    {
                                        player.username
                                    }{" "}
                                    (
                                    {
                                        player.handle
                                    }
                                    )
                                </p>
                            )
                        )}

                        <p>
                            Players:{" "}
                            {teamB.length}/3
                        </p>

                        <button
                            disabled={
                                teamB.length >=
                                    3 ||
                                room.myTeam ===
                                    "B"
                            }
                            onClick={() =>
                                chooseTeam(
                                    "B"
                                )
                            }
                        >
                            {room.myTeam ===
                            "B"
                                ? "You are in Team B"
                                : "Join Team B"}
                        </button>

                    </div>

                </div>

                {/* UNASSIGNED */}

                <div className="card">

                    <h2>
                        Players Without Team
                    </h2>

                    {unassigned.length ===
                    0 ? (
                        <p>
                            None
                        </p>
                    ) : (
                        unassigned.map(
                            (player) => (
                                <p
                                    key={
                                        player.id
                                    }
                                >
                                    {
                                        player.username
                                    }{" "}
                                    (
                                    {
                                        player.handle
                                    }
                                    )
                                </p>
                            )
                        )
                    )}

                </div>

                {/* START */}

                <div className="card">

                    <p>
                        Your team:{" "}
                        <b>
                            {room.myTeam
                                ? `Team ${room.myTeam}`
                                : "Not selected"}
                        </b>
                    </p>

                    {isHost && (
                        <button
                            disabled={
                                teamA.length ===
                                    0 ||
                                teamB.length ===
                                    0
                            }
                            onClick={
                                startGame
                            }
                        >
                            Start Game
                        </button>
                    )}

                    {!isHost && (
                        <p>
                            Waiting for host
                            to start...
                        </p>
                    )}

                </div>

            </div>
        );
    }

    // =====================================================
    // GAME OVER
    // =====================================================

    if (
        page === "game" &&
        room &&
        room.status === "finished"
    ) {
        return (
            <div className="container">

                <div className="card">

                    <h1>
                        Game Over
                    </h1>

                    {room.winner ===
                        "A" && (
                        <h2>
                            Team A Wins!
                        </h2>
                    )}

                    {room.winner ===
                        "B" && (
                        <h2>
                            Team B Wins!
                        </h2>
                    )}

                    {room.winner ===
                        "DRAW" && (
                        <h2>
                            Draw
                        </h2>
                    )}

                    <hr />

                    <h3>
                        Final Score
                    </h3>

                    <p>
                        Team A:{" "}
                        <b>
                            {
                                room.scores.A
                            }
                        </b>
                    </p>

                    <p>
                        Team B:{" "}
                        <b>
                            {
                                room.scores.B
                            }
                        </b>
                    </p>

                </div>

            </div>
        );
    }

    // =====================================================
    // GAME
    // =====================================================

    if (
        page === "game" &&
        room
    ) {
        const myTeam =
            room.myTeam;

        const myTeammates =
            Object.entries(
                teammateCodes
            );

        /*
         * Find currently selected
         * teammate.
         */
        const selectedTeammateData =
            selectedTeammate
                ? teammateCodes[
                      selectedTeammate
                  ]
                : null;

        return (
            <div className="game-container">

                {/* =========================================
                    TOP BAR
                ========================================== */}

                <header className="topbar">

                    <div>
                        <h1>
                            CF Battle
                        </h1>

                        <p>
                            Room:{" "}
                            {
                                room.roomId
                            }
                        </p>
                    </div>

                    <div>
                        <b>
                            Team A:{" "}
                            {
                                room
                                    .scores
                                    .A
                            }
                        </b>

                        {" | "}

                        <b>
                            Team B:{" "}
                            {
                                room
                                    .scores
                                    .B
                            }
                        </b>
                    </div>

                    <div>
                        <b>
                            Time:{" "}
                            {formatTime(
                                room.timeRemaining
                            )}
                        </b>
                    </div>

                    <button
                        onClick={
                            refreshSubmissions
                        }
                    >
                        Refresh Submissions
                    </button>

                </header>

                {error && (
                    <p className="error">
                        {error}
                    </p>
                )}

                <div className="game-layout">

                    {/* =====================================
                        PROBLEMS
                    ====================================== */}

                    <aside className="problems card">

                        <h2>
                            Problems
                        </h2>

                        {room.problems.map(
                            (problem) => {

                                const solvedByA =
                                    room.solved.A.includes(
                                        problem.id
                                    );

                                const solvedByB =
                                    room.solved.B.includes(
                                        problem.id
                                    );

                                const submission =
                                    room
                                        .submissions?.[
                                        problem.id
                                    ];

                                const isSelected =
                                    selectedProblem?.id ===
                                    problem.id;

                                return (
                                    <button
                                        className="problem-button"
                                        key={
                                            problem.id
                                        }
                                        onClick={() =>
                                            chooseProblem(
                                                problem
                                            )
                                        }
                                    >

                                        <b>
                                            {
                                                problem.index
                                            }{" "}
                                            -{" "}
                                            {
                                                problem.name
                                            }
                                        </b>

                                        <span>
                                            Rating:{" "}
                                            {
                                                problem.rating
                                            }
                                        </span>

                                        <span>
                                            Team A:{" "}
                                            {
                                                solvedByA
                                                    ? "Solved"
                                                    : "Not solved"
                                            }
                                        </span>

                                        <span>
                                            Team B:{" "}
                                            {
                                                solvedByB
                                                    ? "Solved"
                                                    : "Not solved"
                                            }
                                        </span>

                                        <span>
                                            A:{" "}
                                            {
                                                submission
                                                    ?.A
                                                    ?.verdict ||
                                                "No submission"
                                            }
                                        </span>

                                        <span>
                                            B:{" "}
                                            {
                                                submission
                                                    ?.B
                                                    ?.verdict ||
                                                "No submission"
                                            }
                                        </span>

                                        {isSelected && (
                                            <span>
                                                Currently
                                                selected
                                            </span>
                                        )}

                                    </button>
                                );
                            }
                        )}

                    </aside>

                    {/* =====================================
                        CENTER
                    ====================================== */}

                    <main className="editor-section">

                        {selectedProblem ? (
                            <>

                                {/* PROBLEM */}

                                <div className="card">

                                    <h2>
                                        {
                                            selectedProblem.name
                                        }
                                    </h2>

                                    <p>
                                        Rating:{" "}
                                        {
                                            selectedProblem.rating
                                        }
                                    </p>

                                    <p>
                                        Tags:{" "}
                                        {
                                            selectedProblem
                                                .tags
                                                ?.join(
                                                    ", "
                                                ) ||
                                            "None"
                                        }
                                    </p>

                                    <div className="problem-statement">

                                        <h3>
                                            Problem
                                        </h3>

                                        <p>
                                            {
                                                selectedProblem.statement
                                            }
                                        </p>

                                        <h3>
                                            Input
                                        </h3>

                                        <p>
                                            {
                                                selectedProblem.input
                                            }
                                        </p>

                                        <h3>
                                            Output
                                        </h3>

                                        <p>
                                            {
                                                selectedProblem.output
                                            }
                                        </p>

                                    </div>

                                    <p>
                                        <a
                                            href={
                                                selectedProblem.codeforcesUrl
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            View Problem
                                            on Codeforces
                                        </a>
                                    </p>

                                    <p>
                                        <a
                                            href={
                                                selectedProblem.submitUrl
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Submit on
                                            Codeforces
                                        </a>
                                    </p>

                                </div>

                                {/* =================================
                                    MY EDITOR
                                ================================== */}

                                <div className="card">

                                    <h2>
                                        My Code
                                    </h2>

                                    <Editor
                                        height="500px"
                                        defaultLanguage="cpp"
                                        value={
                                            myCode
                                        }
                                        onChange={
                                            changeCode
                                        }
                                        theme="vs-dark"
                                        options={{
                                            fontSize:
                                                14,

                                            minimap: {
                                                enabled:
                                                    false
                                            },

                                            wordWrap:
                                                "on"
                                        }}
                                    />

                                </div>

                                {/* =================================
                                    SUBMISSION STATUS
                                ================================== */}

                                <div className="card">

                                    <h2>
                                        Submission
                                        Status
                                    </h2>

                                    <p>
                                        Team A:{" "}
                                        <b>
                                            {
                                                room
                                                    .submissions?.[
                                                    selectedProblem.id
                                                ]?.A
                                                    ?.verdict ||
                                                "No submission"
                                            }
                                        </b>

                                        {room
                                            .submissions?.[
                                            selectedProblem.id
                                        ]?.A
                                            ?.username && (
                                            <>
                                                {" "}
                                                by{" "}
                                                {
                                                    room
                                                        .submissions?.[
                                                        selectedProblem.id
                                                    ]?.A
                                                        ?.username
                                                }
                                            </>
                                        )}
                                    </p>

                                    <p>
                                        Team B:{" "}
                                        <b>
                                            {
                                                room
                                                    .submissions?.[
                                                    selectedProblem.id
                                                ]?.B
                                                    ?.verdict ||
                                                "No submission"
                                            }
                                        </b>

                                        {room
                                            .submissions?.[
                                            selectedProblem.id
                                        ]?.B
                                            ?.username && (
                                            <>
                                                {" "}
                                                by{" "}
                                                {
                                                    room
                                                        .submissions?.[
                                                        selectedProblem.id
                                                    ]?.B
                                                        ?.username
                                                }
                                            </>
                                        )}
                                    </p>

                                </div>

                            </>
                        ) : (
                            <div className="card">

                                <h2>
                                    Select a problem
                                </h2>

                                <p>
                                    Choose a
                                    problem from
                                    the left side.
                                </p>

                            </div>
                        )}

                    </main>

                    {/* =====================================
                        RIGHT SIDE
                    ====================================== */}

                    <aside className="right-section">

                        {/* TEAM CHAT */}

                        <div className="card">

                            <h2>
                                Team{" "}
                                {myTeam} Chat
                            </h2>

                            <div className="chat-box">

                                {room
                                    .teamMessages
                                    .length ===
                                    0 && (
                                    <p>
                                        No messages
                                        yet
                                    </p>
                                )}

                                {room.teamMessages.map(
                                    (message) => (
                                        <p
                                            key={
                                                message.id
                                            }
                                        >
                                            <b>
                                                {
                                                    message.username
                                                }:
                                            </b>{" "}
                                            {
                                                message.message
                                            }
                                        </p>
                                    )
                                )}

                            </div>

                            <div className="chat-input">

                                <input
                                    value={
                                        teamMessage
                                    }
                                    onChange={(e) =>
                                        setTeamMessage(
                                            e.target.value
                                        )
                                    }
                                    onKeyDown={(e) => {
                                        if (
                                            e.key ===
                                            "Enter"
                                        ) {
                                            sendTeamChat();
                                        }
                                    }}
                                    placeholder="Message your team"
                                />

                                <button
                                    onClick={
                                        sendTeamChat
                                    }
                                >
                                    Send
                                </button>

                            </div>

                        </div>

                        {/* DISTURB CHAT */}

                        <div className="card">

                            <h2>
                                Disturb Chat
                            </h2>

                            <div className="chat-box">

                                {room
                                    .disturbMessages
                                    .length ===
                                    0 && (
                                    <p>
                                        No messages
                                        yet
                                    </p>
                                )}

                                {room.disturbMessages.map(
                                    (message) => (
                                        <p
                                            key={
                                                message.id
                                            }
                                        >
                                            <b>
                                                [
                                                {
                                                    message.team
                                                }]{" "}
                                                {
                                                    message.username
                                                }:
                                            </b>{" "}
                                            {
                                                message.message
                                            }
                                        </p>
                                    )
                                )}

                            </div>

                            <div className="chat-input">

                                <input
                                    value={
                                        disturbMessage
                                    }
                                    onChange={(e) =>
                                        setDisturbMessage(
                                            e.target.value
                                        )
                                    }
                                    onKeyDown={(e) => {
                                        if (
                                            e.key ===
                                            "Enter"
                                        ) {
                                            sendDisturbChat();
                                        }
                                    }}
                                    placeholder="Message other team"
                                />

                                <button
                                    onClick={
                                        sendDisturbChat
                                    }
                                >
                                    Send
                                </button>

                            </div>

                        </div>

                    </aside>

                </div>

                {/* =========================================
                    TEAMMATE CODE
                ========================================== */}

                <div className="card">

                    <h2>
                        Team Members
                    </h2>

                    {myTeammates.length ===
                        0 && (
                        <p>
                            No other teammate is
                            connected.
                        </p>
                    )}

                    {myTeammates.map(
                        ([playerId, teammate]) => {

                            const isSelected =
                                selectedTeammate ===
                                playerId;

                            const teammateProblem =
                                findProblem(
                                    teammate.currentProblemId
                                );

                            const teammateCode =
                                selectedProblem
                                    ? teammate.codes?.[
                                          selectedProblem.id
                                      ] || ""
                                    : "";

                            return (
                                <div
                                    className="teammate-code"
                                    key={
                                        playerId
                                    }
                                >

                                    <button
                                        onClick={() =>
                                            setSelectedTeammate(
                                                isSelected
                                                    ? null
                                                    : playerId
                                            )
                                        }
                                    >
                                        {isSelected
                                            ? `Hide ${teammate.username}`
                                            : `View ${teammate.username}'s code`}
                                    </button>

                                    <h3>
                                        {
                                            teammate.username
                                        }
                                    </h3>

                                    <p>
                                        Working
                                        on:{" "}
                                        {teammateProblem
                                            ? teammateProblem.name
                                            : "No problem"}
                                    </p>

                                    {isSelected && (
                                        <Editor
                                            height="350px"
                                            defaultLanguage="cpp"
                                            value={
                                                teammateCode
                                            }
                                            theme="vs-dark"
                                            options={{
                                                readOnly:
                                                    true,

                                                fontSize:
                                                    14,

                                                minimap: {
                                                    enabled:
                                                        false
                                                },

                                                wordWrap:
                                                    "on"
                                            }}
                                        />
                                    )}

                                </div>
                            );
                        }
                    )}

                </div>

                {/* =========================================
                    PLAYERS
                ========================================== */}

                <div className="card">

                    <h2>
                        Players
                    </h2>

                    {room.players.map(
                        (player) => (
                            <p
                                key={
                                    player.id
                                }
                            >

                                <b>
                                    {
                                        player.username
                                    }
                                </b>

                                {" ("}

                                {
                                    player.handle
                                }

                                {") - Team "}

                                {
                                    player.team ||
                                    "None"
                                }

                            </p>
                        )
                    )}

                </div>

            </div>
        );
    }

    return null;
}

export default App;
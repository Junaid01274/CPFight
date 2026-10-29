import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import socket from "../socket";
import useCountdown from "../hooks/useCountdown";
import { formatTime } from "../utils";
import ProblemList from "./ProblemList";
import ProblemView from "./ProblemView";
import ChatBox from "./ChatBox";
import TeammateCode from "./TeammateCode";
import PlayerTag from "./PlayerTag";

const CODE_SEND_DELAY_MS = 300;

const CPP_TEMPLATE = `#include <bits/stdc++.h>
using namespace std;

int main() {

    return 0;
}
`;

function Game({ room }) {
    const [selectedId, setSelectedId] = useState(room.me.currentProblemId);

    // read from the server only once, so a late copy can never undo typing
    const [myCodes, setMyCodes] = useState(room.me.codes || {});
    const [checking, setChecking] = useState(false);

    const pendingCode = useRef(null);
    const sendTimer = useRef(null);

    const timeLeft = useCountdown(room.endsAt, room.clockOffset);
    const selectedProblem = room.problems.find((p) => p.id === selectedId);

    useEffect(() => {
        function onChecked() {
            setChecking(false);
        }
        socket.on("submissionsChecked", onChecked);

        return () => {
            socket.off("submissionsChecked", onChecked);
            clearTimeout(sendTimer.current);
        };
    }, []);

    function sendPendingCode() {
        clearTimeout(sendTimer.current);
        if (pendingCode.current) {
            socket.emit("codeUpdate", pendingCode.current);
            pendingCode.current = null;
        }
    }

    function changeCode(value) {
        const code = value ?? "";
        setMyCodes((prev) => ({ ...prev, [selectedId]: code }));

        pendingCode.current = { problemId: selectedId, code };
        clearTimeout(sendTimer.current);
        sendTimer.current = setTimeout(sendPendingCode, CODE_SEND_DELAY_MS);
    }

    function chooseProblem(problemId) {
        sendPendingCode();
        setSelectedId(problemId);
        socket.emit("selectProblem", problemId);
    }

    function refreshSubmissions() {
        setChecking(true);
        socket.emit("refreshSubmissions");
    }

    return (
        <div className="game-container">
            <header className="topbar">
                <div>
                    <h1>CF Battle</h1>
                    <p>
                        Room: {room.roomId} | You are in <b>Team {room.myTeam}</b>
                    </p>
                </div>

                <div className="scoreboard">
                    <b className="team-A-text">Team A: {room.scores.A}</b>
                    {" | "}
                    <b className="team-B-text">Team B: {room.scores.B}</b>
                </div>

                <div className={timeLeft !== null && timeLeft < 60 ? "timer timer-low" : "timer"}>
                    <b>Time: {formatTime(timeLeft)}</b>
                </div>

                <button onClick={refreshSubmissions} disabled={checking}>
                    {checking ? "Checking..." : "Refresh Submissions"}
                </button>
            </header>

            <div className="game-layout">
                <ProblemList room={room} selectedId={selectedId} onSelect={chooseProblem} />

                <main className="editor-section">
                    {selectedProblem ? (
                        <>
                            <ProblemView problem={selectedProblem} room={room} />

                            <div className="card">
                                <h2>My Code</h2>
                                <Editor
                                    height="500px"
                                    path={selectedProblem.id}
                                    defaultLanguage="cpp"
                                    defaultValue={myCodes[selectedProblem.id] ?? CPP_TEMPLATE}
                                    onChange={changeCode}
                                    theme="vs-dark"
                                    options={{
                                        fontSize: 14,
                                        minimap: { enabled: false },
                                        wordWrap: "on"
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="card">
                            <h2>Select a problem</h2>
                            <p>Choose a problem from the left side.</p>
                        </div>
                    )}
                </main>

                <aside className="right-section">
                    <ChatBox
                        title={`Team ${room.myTeam} Chat`}
                        messages={room.teamMessages}
                        placeholder="Message your team"
                        onSend={(text) => socket.emit("sendTeamMessage", text)}
                    />

                    <ChatBox
                        title="Disturb Chat"
                        messages={room.disturbMessages}
                        showTeam
                        placeholder="Message the other team"
                        onSend={(text) => socket.emit("sendDisturbMessage", text)}
                    />
                </aside>
            </div>

            <TeammateCode room={room} />

            <div className="card">
                <h2>Players</h2>
                {room.players.map((player) => (
                    <p key={player.id}>
                        <PlayerTag player={player} isMe={player.id === room.me.id} /> - Team {player.team}
                    </p>
                ))}
            </div>
        </div>
    );
}

export default Game;

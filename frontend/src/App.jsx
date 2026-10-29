import { useEffect, useState } from "react";
import socket from "./socket";
import Home from "./components/Home";
import Lobby from "./components/Lobby";
import Game from "./components/Game";
import GameOver from "./components/GameOver";
import VerifyHandle from "./components/VerifyHandle";
import {
    saveSession,
    loadSession,
    clearSession,
    getVerifyToken,
    saveVerifyToken,
    saveVerification,
    loadVerification,
    clearVerification
} from "./utils";

function App() {
    const [room, setRoom] = useState(null);
    const [verification, setVerification] = useState(() => loadVerification());
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        function onConnect() {
            setConnected(true);

            const session = loadSession();
            if (session) {
                socket.emit("rejoinRoom", session);
            }
        }

        function onDisconnect() {
            setConnected(false);
            setLoading(false);
        }

        function onVerificationNeeded(data) {
            const v = { ...data, clockOffset: data.serverTime - Date.now() };
            saveVerification(v);
            setVerification(v);
            setLoading(false);
        }

        function onHandleVerified({ handle, verifyToken }) {
            saveVerifyToken(handle, verifyToken);
            clearVerification();
            setVerification(null);
        }

        function onVerificationCancelled(message) {
            clearVerification();
            setVerification(null);
            setLoading(false);
            setError(message || "");
        }

        function onJoinedRoom(session) {
            saveSession(session);
            setLoading(false);
            setError("");
        }

        function onRejoinFailed(message) {
            clearSession();
            setRoom(null);
            setError(message || "");
        }

        function onRoomState(state) {
            setRoom({
                ...state,
                clockOffset: state.serverTime - Date.now()
            });
        }

        function onTeamCodeUpdate(data) {
            setRoom((prev) => {
                if (!prev) {
                    return prev;
                }

                const old = prev.teamCodes[data.playerId] || { codes: {} };

                return {
                    ...prev,
                    teamCodes: {
                        ...prev.teamCodes,
                        [data.playerId]: {
                            username: data.username,
                            currentProblemId: data.problemId,
                            codes: { ...old.codes, [data.problemId]: data.code }
                        }
                    }
                };
            });
        }

        function onTeamMessage(message) {
            setRoom((prev) =>
                prev && { ...prev, teamMessages: [...prev.teamMessages, message].slice(-100) }
            );
        }

        function onDisturbMessage(message) {
            setRoom((prev) =>
                prev && { ...prev, disturbMessages: [...prev.disturbMessages, message].slice(-100) }
            );
        }

        function onErrorMessage(message) {
            setError(message);
            setLoading(false);
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("joinedRoom", onJoinedRoom);
        socket.on("rejoinFailed", onRejoinFailed);
        socket.on("roomState", onRoomState);
        socket.on("teamCodeUpdate", onTeamCodeUpdate);
        socket.on("teamMessage", onTeamMessage);
        socket.on("disturbMessage", onDisturbMessage);
        socket.on("errorMessage", onErrorMessage);
        socket.on("verificationNeeded", onVerificationNeeded);
        socket.on("handleVerified", onHandleVerified);
        socket.on("verificationCancelled", onVerificationCancelled);

        socket.connect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("joinedRoom", onJoinedRoom);
            socket.off("rejoinFailed", onRejoinFailed);
            socket.off("roomState", onRoomState);
            socket.off("teamCodeUpdate", onTeamCodeUpdate);
            socket.off("teamMessage", onTeamMessage);
            socket.off("disturbMessage", onDisturbMessage);
            socket.off("errorMessage", onErrorMessage);
            socket.off("verificationNeeded", onVerificationNeeded);
            socket.off("handleVerified", onHandleVerified);
            socket.off("verificationCancelled", onVerificationCancelled);
        };
    }, []);

    useEffect(() => {
        if (!error) {
            return;
        }
        const timer = setTimeout(() => setError(""), 5000);
        return () => clearTimeout(timer);
    }, [error]);

    function createRoom(username, handle) {
        setError("");
        setLoading(true);
        socket.emit("createRoom", { username, handle, verifyToken: getVerifyToken(handle) });
    }

    function joinRoom(roomId, username, handle) {
        setError("");
        setLoading(true);
        socket.emit("joinRoom", { roomId, username, handle, verifyToken: getVerifyToken(handle) });
    }

    function checkVerification() {
        setError("");
        setLoading(true);
        socket.emit("checkVerification", { challengeId: verification.challengeId });
    }

    function cancelVerification() {
        socket.emit("cancelVerification", { challengeId: verification?.challengeId });
        clearVerification();
        setVerification(null);
        setLoading(false);
    }

    function leaveRoom() {
        socket.emit("leaveRoom");
        clearSession();
        setRoom(null);
        setError("");
    }

    let page;
    if (!room && verification) {
        page = (
            <VerifyHandle
                verification={verification}
                loading={loading}
                onCheck={checkVerification}
                onCancel={cancelVerification}
            />
        );
    } else if (!room) {
        page = <Home onCreate={createRoom} onJoin={joinRoom} loading={loading} />;
    } else if (room.status === "lobby") {
        page = <Lobby room={room} onLeave={leaveRoom} />;
    } else if (room.status === "running") {
        page = <Game room={room} />;
    } else {
        page = <GameOver room={room} onLeave={leaveRoom} />;
    }

    return (
        <>
            {!connected && (
                <div className="connection-banner">Connecting to server...</div>
            )}

            {page}

            {error && <p className="error toast">{error}</p>}
        </>
    );
}

export default App;

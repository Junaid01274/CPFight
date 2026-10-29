import { useState } from "react";
import socket from "../socket";
import TeamColumn from "./TeamColumn";
import PlayerTag from "./PlayerTag";

function Lobby({ room, onLeave }) {
    const [copied, setCopied] = useState(false);

    const unassigned = room.players.filter((player) => !player.team);
    const teamASize = room.players.filter((player) => player.team === "A").length;
    const teamBSize = room.players.filter((player) => player.team === "B").length;
    const isHost = room.hostId === room.me.id;

    function copyInviteLink() {
        const link = `${window.location.origin}/?room=${room.roomId}`;

        navigator.clipboard
            .writeText(link)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                window.prompt("Copy this link:", link);
            });
    }

    return (
        <div className="container">
            <h1>CF Battle</h1>

            <div className="lobby-header card">
                <div>
                    <h2>
                        Room: <span className="room-code">{room.roomId}</span>
                    </h2>
                    <p className="muted">
                        {room.settings.gameMinutes} minute game, {room.settings.problemCount} problems
                    </p>
                </div>

                <div className="button-row">
                    <button onClick={copyInviteLink}>
                        {copied ? "Copied!" : "Copy invite link"}
                    </button>
                    <button className="secondary" onClick={onLeave}>
                        Leave
                    </button>
                </div>
            </div>

            <div className="teams">
                <TeamColumn team="A" room={room} />
                <TeamColumn team="B" room={room} />
            </div>

            <div className="card">
                <h2>Players Without Team</h2>

                {unassigned.length === 0 ? (
                    <p className="muted">None</p>
                ) : (
                    unassigned.map((player) => (
                        <p key={player.id}>
                            <PlayerTag
                                player={player}
                                isHost={player.id === room.hostId}
                                isMe={player.id === room.me.id}
                            />
                        </p>
                    ))
                )}

                {unassigned.length > 0 && (
                    <p className="muted">
                        Players without a team are put in the smaller team when the game starts.
                    </p>
                )}
            </div>

            <div className="card">
                <p>
                    Your team: <b>{room.myTeam ? `Team ${room.myTeam}` : "Not selected"}</b>
                </p>

                {isHost ? (
                    <button
                        disabled={teamASize === 0 || teamBSize === 0}
                        onClick={() => socket.emit("startGame")}
                    >
                        Start Game
                    </button>
                ) : (
                    <p className="muted">Waiting for the host to start...</p>
                )}
            </div>
        </div>
    );
}

export default Lobby;

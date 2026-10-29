import socket from "../socket";
import PlayerTag from "./PlayerTag";

function TeamColumn({ team, room }) {
    const players = room.players.filter((player) => player.team === team);
    const maxSize = room.settings.maxTeamSize;
    const isMyTeam = room.myTeam === team;

    return (
        <div className={`card team-card team-${team}`}>
            <h2>Team {team}</h2>

            {players.length === 0 && <p className="muted">No players yet</p>}

            {players.map((player) => (
                <p key={player.id}>
                    <PlayerTag
                        player={player}
                        isHost={player.id === room.hostId}
                        isMe={player.id === room.me.id}
                    />
                </p>
            ))}

            <p className="muted">
                Players: {players.length}/{maxSize}
            </p>

            <button
                disabled={players.length >= maxSize || isMyTeam}
                onClick={() => socket.emit("joinTeam", team)}
            >
                {isMyTeam ? `You are in Team ${team}` : `Join Team ${team}`}
            </button>
        </div>
    );
}

export default TeamColumn;

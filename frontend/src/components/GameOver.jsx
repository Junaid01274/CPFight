import { formatTime } from "../utils";

function GameOver({ room, onLeave }) {
    const startSec = Math.floor(room.startedAt / 1000);

    let title = "It's a draw";
    if (room.winner === room.myTeam) {
        title = "Your team won!";
    } else if (room.winner === "A" || room.winner === "B") {
        title = `Team ${room.winner} wins`;
    }

    function solveTime(team, problemId) {
        const time = room.solved[team][problemId];
        return time ? formatTime(time - startSec) : "-";
    }

    return (
        <div className="container">
            <div className="card">
                <h1>Game Over</h1>
                <h2>{title}</h2>

                <p>
                    Team A: <b>{room.scores.A}</b> | Team B: <b>{room.scores.B}</b>
                </p>
                {room.scores.A === room.scores.B && room.scores.A > 0 && room.winner !== "DRAW" && (
                    <p className="muted">Same score, so the team that finished its problems first wins.</p>
                )}

                <hr />

                <h3>Problems</h3>
                <table className="results">
                    <thead>
                        <tr>
                            <th>Problem</th>
                            <th>Team A</th>
                            <th>Team B</th>
                        </tr>
                    </thead>
                    <tbody>
                        {room.problems.map((problem) => (
                            <tr key={problem.id}>
                                <td>
                                    <a href={problem.codeforcesUrl} target="_blank" rel="noreferrer">
                                        {problem.id} - {problem.name}
                                    </a>
                                </td>
                                <td>{solveTime("A", problem.id)}</td>
                                <td>{solveTime("B", problem.id)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <hr />

                <button onClick={onLeave}>Back to Home</button>
            </div>
        </div>
    );
}

export default GameOver;

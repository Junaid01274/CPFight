import { verdictText, verdictClass } from "../utils";

function ProblemList({ room, selectedId, onSelect }) {
    return (
        <aside className="problems card">
            <h2>Problems</h2>

            {room.problems.map((problem) => {
                const solvedByMe = room.myTeam && room.solved[room.myTeam][problem.id];
                const submission = room.submissions[problem.id] || {};

                const teammatesHere = room.players.filter(
                    (p) =>
                        p.team === room.myTeam &&
                        p.id !== room.me.id &&
                        p.currentProblemId === problem.id
                );

                let className = "problem-button";
                if (problem.id === selectedId) className += " selected";
                if (solvedByMe) className += " solved";

                return (
                    <button
                        key={problem.id}
                        className={className}
                        onClick={() => onSelect(problem.id)}
                    >
                        <b>
                            {problem.contestId}
                            {problem.index} - {problem.name}
                        </b>
                        <span>Rating: {problem.rating}</span>
                        <span>
                            A:{" "}
                            <em className={verdictClass(submission.A?.verdict)}>
                                {room.solved.A[problem.id] ? "Solved" : verdictText(submission.A?.verdict)}
                            </em>
                        </span>
                        <span>
                            B:{" "}
                            <em className={verdictClass(submission.B?.verdict)}>
                                {room.solved.B[problem.id] ? "Solved" : verdictText(submission.B?.verdict)}
                            </em>
                        </span>
                        {teammatesHere.length > 0 && (
                            <span className="teammates-here">
                                {teammatesHere.map((p) => p.username).join(", ")} here
                            </span>
                        )}
                    </button>
                );
            })}
        </aside>
    );
}

export default ProblemList;

import { verdictText, verdictClass } from "../utils";

function TeamSubmission({ team, submission }) {
    return (
        <p>
            Team {team}:{" "}
            <b className={verdictClass(submission?.verdict)}>{verdictText(submission?.verdict)}</b>
            {submission?.username && (
                <span className="muted">
                    {" "}by {submission.username} ({submission.language})
                </span>
            )}
        </p>
    );
}

function ProblemView({ problem, room }) {
    const submission = room.submissions[problem.id] || {};

    return (
        <div className="card">
            <h2>{problem.name}</h2>
            <p>
                Rating: {problem.rating} | Tags: {problem.tags?.join(", ") || "None"}
            </p>

            <div className="problem-statement">
                <h3>Problem</h3>
                <p>{problem.statement}</p>

                <h3>Input</h3>
                <p>{problem.input}</p>

                <h3>Output</h3>
                <p>{problem.output}</p>
            </div>

            <p className="muted">
                This is a short version of the statement. Read the full one (with examples) on Codeforces.
            </p>

            <div className="button-row">
                <a className="link-button" href={problem.codeforcesUrl} target="_blank" rel="noreferrer">
                    View on Codeforces
                </a>
                <a className="link-button" href={problem.submitUrl} target="_blank" rel="noreferrer">
                    Submit on Codeforces
                </a>
            </div>

            <hr />

            <h3>Submission Status</h3>
            <TeamSubmission team="A" submission={submission.A} />
            <TeamSubmission team="B" submission={submission.B} />
        </div>
    );
}

export default ProblemView;

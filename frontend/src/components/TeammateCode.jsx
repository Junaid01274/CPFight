import { useState } from "react";
import Editor from "@monaco-editor/react";

function TeammateCode({ room }) {
    const [watching, setWatching] = useState(null);
    const teammates = Object.entries(room.teamCodes);

    function problemName(problemId) {
        const problem = room.problems.find((p) => p.id === problemId);
        return problem ? problem.name : "No problem yet";
    }

    return (
        <div className="card">
            <h2>Team Members</h2>

            {teammates.length === 0 && <p className="muted">You don't have teammates in this game.</p>}

            {teammates.map(([playerId, mate]) => {
                const isWatching = watching === playerId;
                const code = mate.codes?.[mate.currentProblemId] || "";

                return (
                    <div className="teammate-code" key={playerId}>
                        <button onClick={() => setWatching(isWatching ? null : playerId)}>
                            {isWatching ? `Hide ${mate.username}'s code` : `Watch ${mate.username}'s code`}
                        </button>

                        <h3>{mate.username}</h3>
                        <p>Working on: {problemName(mate.currentProblemId)}</p>

                        {isWatching && (
                            <Editor
                                height="350px"
                                defaultLanguage="cpp"
                                value={code}
                                theme="vs-dark"
                                options={{
                                    readOnly: true,
                                    fontSize: 14,
                                    minimap: { enabled: false },
                                    wordWrap: "on"
                                }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default TeammateCode;

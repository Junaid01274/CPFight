import useCountdown from "../hooks/useCountdown";
import { formatTime } from "../utils";

function VerifyHandle({ verification, loading, onCheck, onCancel }) {
    const { handle, problem } = verification;
    const timeLeft = useCountdown(verification.expiresAt, verification.clockOffset);
    const timeUp = timeLeft === 0;

    return (
        <div className="container">
            <h1>CF Battle</h1>

            <div className="card home-card">
                <h2>
                    Prove that <span className="handle-name">{handle}</span> is you
                </h2>
                <p>
                    Anyone can type a handle, so we check that you own it. You only do this once on
                    this browser.
                </p>

                <ol className="steps">
                    <li>
                        Log in to Codeforces as <b>{handle}</b> and open{" "}
                        <a href={problem.submitUrl} target="_blank" rel="noreferrer">
                            {problem.contestId}
                            {problem.index} - {problem.name}
                        </a>
                        .
                    </li>
                    <li>
                        Pick GNU C++ and submit something that doesn't compile, like:
                        <pre className="code-sample">this will not compile</pre>
                    </li>
                    <li>Wait until Codeforces says &quot;Compilation error&quot;, then click the button.</li>
                </ol>

                <p className={timeLeft !== null && timeLeft < 30 ? "muted timer-low" : "muted"}>
                    <b>Time left: {formatTime(timeLeft)}</b>
                </p>

                <div className="button-row">
                    <button onClick={onCheck} disabled={loading || timeUp}>
                        {loading ? "Checking..." : "I've submitted"}
                    </button>
                    <button className="secondary" onClick={onCancel}>
                        {timeUp ? "Start again" : "Cancel"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VerifyHandle;

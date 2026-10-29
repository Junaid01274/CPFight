import { useState } from "react";
import { getSaved, setSaved } from "../utils";

function Home({ onCreate, onJoin, loading }) {
    const [username, setUsername] = useState(() => getSaved("cfbattle-username"));
    const [handle, setHandle] = useState(() => getSaved("cfbattle-handle"));
    const [roomInput, setRoomInput] = useState(
        () => new URLSearchParams(window.location.search).get("room") || ""
    );
    const [formError, setFormError] = useState("");

    function checkForm(needRoom) {
        if (!username.trim()) return "Enter a username";
        if (!handle.trim()) return "Enter your Codeforces handle";
        if (needRoom && !roomInput.trim()) return "Enter a room ID";
        return "";
    }

    function handleCreate() {
        const problem = checkForm(false);
        setFormError(problem);
        if (problem) {
            return;
        }

        setSaved("cfbattle-username", username.trim());
        setSaved("cfbattle-handle", handle.trim());
        onCreate(username.trim(), handle.trim());
    }

    function handleJoin() {
        const problem = checkForm(true);
        setFormError(problem);
        if (problem) {
            return;
        }

        setSaved("cfbattle-username", username.trim());
        setSaved("cfbattle-handle", handle.trim());
        onJoin(roomInput.trim().toUpperCase(), username.trim(), handle.trim());
    }

    return (
        <div className="container">
            <h1>CF Battle</h1>
            <p className="subtitle">Team vs team on Codeforces problems, in real time</p>

            <div className="card home-card">
                <h2>Create / Join Room</h2>

                <input
                    type="text"
                    placeholder="Username"
                    maxLength={20}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    type="text"
                    placeholder="Codeforces Handle"
                    maxLength={24}
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                />

                <button onClick={handleCreate} disabled={loading}>
                    {loading ? "Checking handle..." : "Create Room"}
                </button>

                <hr />

                <input
                    type="text"
                    placeholder="Room ID"
                    maxLength={5}
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoin();
                    }}
                />

                <button onClick={handleJoin} disabled={loading}>
                    {loading ? "Checking handle..." : "Join Room"}
                </button>

                {formError && <p className="error">{formError}</p>}
            </div>

            <div className="card home-card">
                <h2>How it works</h2>
                <ol className="steps">
                    <li>Create a room and send the room ID to your friends.</li>
                    <li>Split into Team A and Team B (up to 3 each).</li>
                    <li>The host starts the game and everyone gets the same problems.</li>
                    <li>Write code here, submit it on Codeforces. Accepted submissions are picked up automatically.</li>
                    <li>Most problems solved when the timer ends wins.</li>
                </ol>
            </div>
        </div>
    );
}

export default Home;

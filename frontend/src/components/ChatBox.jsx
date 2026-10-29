import { useEffect, useRef, useState } from "react";

function ChatBox({ title, messages, showTeam, placeholder, onSend }) {
    const [text, setText] = useState("");
    const boxRef = useRef(null);

    useEffect(() => {
        if (boxRef.current) {
            boxRef.current.scrollTop = boxRef.current.scrollHeight;
        }
    }, [messages.length]);

    function send() {
        const message = text.trim();
        if (!message) {
            return;
        }
        onSend(message);
        setText("");
    }

    return (
        <div className="card">
            <h2>{title}</h2>

            <div className="chat-box" ref={boxRef}>
                {messages.length === 0 && <p className="muted">No messages yet</p>}

                {messages.map((message) => (
                    <p key={message.id}>
                        <b>
                            {showTeam && `[${message.team}] `}
                            {message.username}:
                        </b>{" "}
                        {message.message}
                    </p>
                ))}
            </div>

            <div className="chat-input">
                <input
                    value={text}
                    maxLength={500}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") send();
                    }}
                    placeholder={placeholder}
                />
                <button onClick={send}>Send</button>
            </div>
        </div>
    );
}

export default ChatBox;

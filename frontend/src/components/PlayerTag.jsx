import { ratingClass } from "../utils";

function PlayerTag({ player, isHost, isMe }) {
    return (
        <span className="player-tag">
            <b>{player.username}</b>{" "}
            <a
                className={ratingClass(player.rating)}
                href={`https://codeforces.com/profile/${player.handle}`}
                target="_blank"
                rel="noreferrer"
            >
                {player.handle}
            </a>
            {player.rating && <span className="muted"> ({player.rating})</span>}
            {isMe && <span className="badge">you</span>}
            {isHost && <span className="badge">host</span>}
            {!player.connected && <span className="badge badge-offline">offline</span>}
        </span>
    );
}

export default PlayerTag;

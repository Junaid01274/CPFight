# CPFight
**Live demo:** https://cp-fight.vercel.app

(The first load can take up to a minute while the free server wakes up.)

A real time team battle on Codeforces problems. Two teams of up to 3 people get the same random set of problems. You can see your teammates' code live, chat with your team, and send messages to annoy the other team. Solutions are submitted on Codeforces itself, and the server checks the Codeforces API to see who got Accepted. When the timer ends, the team with more solved problems wins.

I made this because practising with friends on Codeforces felt boring alone, and virtual contests don't have teams.

## Features

- Create a room and share a 5 character code or an invite link
- You have to prove a Codeforces handle is yours before you can play as it (once per browser)
- Team A vs Team B, up to 3 players each, host starts the game
- Server picks random problems (from `backend/data/problems.json`)
- Monaco code editor (the same editor as VS Code), and each problem keeps its own code
- Watch any teammate's code live (the other team can never see it)
- Team chat + "disturb chat" for both teams
- Verdicts from Codeforces are picked up automatically every 10 seconds, or with the refresh button
- Refreshing the page or a short network drop doesn't kick you out, you get your spot back
- Tie breaker: if both teams solve the same number, the team that got its last AC first wins

## Tech stack

- **Frontend:** React 19, Vite, Monaco editor, socket.io-client
- **Backend:** Node.js, Express 5, Socket.IO
- **Tests:** Node's built-in test runner (`node:test`), unit tests + an end to end socket test

## How it works

```
  Browser (React)                     Node server                      Codeforces API
 +----------------+   socket.io   +--------------------+   HTTPS    +----------------+
 | Home / Lobby / | <-----------> | socketHandlers.js  |            |  user.info     |
 | Game / GameOver|   events      |   |                |  ------->  |  user.status   |
 +----------------+               |   v                |  (queue,   +----------------+
                                  | room.js (rules)    |   1 req /
                                  | roomStore.js (Map) |   2 sec)
                                  | jobs.js (timers)   |
                                  +--------------------+
```

1. Player creates/joins a room. The server checks the handle exists with `user.info`, then asks the player to prove it's theirs (see "Proving you own a handle" below).
2. Players pick teams in the lobby. The host starts the game, the server picks the problems and sets `endsAt`.
3. While typing, code is sent to the server (debounced, 300ms) and forwarded only to teammates.
4. Players submit on codeforces.com. Every 10 seconds the server calls `user.status` for each player and looks for submissions made during the game.
5. A background job ends the game when `endsAt` is reached and everyone gets the final result.

The server is the source of truth. The client never decides the score, the problems or the time. Every player gets their own version of the room state (`buildStateFor` in `state.js`) so the other team's code and chat are never sent to them.

## Project structure

```
backend/
  server.js             starts express + socket.io
  data/problems.json    problem list
  src/
    config.js           all limits and settings in one place
    room.js             game rules (pure functions, no sockets)
    state.js            what each player is allowed to see
    roomStore.js        in-memory storage (Map)
    socketHandlers.js   socket events -> room.js -> broadcast
    broadcast.js        send state / events to players
    codeforces.js       Codeforces API client with rate limit queue + cache
    submissions.js      checks Codeforces for new verdicts
    verify.js           handle verification (challenge + remembered handles)
    jobs.js             timers: end games, poll submissions, clean old rooms
    validate.js         input checks
    app.js              express routes (/ and /health)
  tests/                unit tests + end to end socket test
frontend/
  src/
    App.jsx             socket listeners, picks which page to show
    components/         Home, VerifyHandle, Lobby, Game, GameOver, ChatBox, ...
    hooks/useCountdown.js
    utils.js
```

## Running locally

You need Node 20 or newer.

```bash
# terminal 1
cd backend
npm install
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. To try it alone, open a second tab (each tab is a separate player) and join with a different Codeforces handle.

Settings are optional, every one has a default. To change them, create `backend/.env` (it's in `.gitignore`):

- `PORT=5000` and `FRONTEND_URL=http://localhost:5173` (the defaults)
- `GAME_MINUTES=2` for a short game while testing
- `FAKE_CODEFORCES=true` to run without the real Codeforces API (any handle works, no submissions). Codeforces goes down sometimes, so this is handy for demos. The handle check is off in this mode.
- `VERIFY_HANDLES=false` to turn the handle check off (or `true` to force it on, even in fake mode)

The frontend reads `VITE_BACKEND_URL` from `frontend/.env` (default `http://localhost:5000`).

## Tests

```bash
cd backend
npm test
```

- `room.test.js`: game rules (joining, teams, starting, scoring, tie break, cleanup)
- `state.test.js`: privacy, you never get the other team's code or chat, tokens are never sent
- `socket.test.js`: starts a real server and real socket clients (Codeforces is faked) and plays through a game, including rejoining after refresh, sending garbage payloads and the whole handle verification flow
- `verify.test.js`: what counts as proof, and remembered handles
- `validate.test.js`, `problems.test.js`, `roomStore.test.js`, `jobs.test.js`

## Socket events

| Client -> Server | Payload | What it does |
| --- | --- | --- |
| `createRoom` | `{ username, handle, verifyToken }` | create a room and become host |
| `joinRoom` | `{ roomId, username, handle, verifyToken }` | join a room in the lobby |
| `checkVerification` | `{ challengeId }` | "I've submitted the compile error, check it" |
| `cancelVerification` | `{ challengeId }` | give up on verifying |
| `rejoinRoom` | `{ roomId, token }` | get your spot back after a refresh |
| `leaveRoom` | - | leave the room |
| `joinTeam` | `"A"` or `"B"` | pick a team (lobby only) |
| `startGame` | - | host only |
| `selectProblem` | `problemId` | tell teammates what you are working on |
| `codeUpdate` | `{ problemId, code }` | share your code with teammates |
| `sendTeamMessage` | `text` | team chat |
| `sendDisturbMessage` | `text` | chat that both teams see |
| `refreshSubmissions` | - | check Codeforces now (15s cooldown per room) |

| Server -> Client | Payload |
| --- | --- |
| `verificationNeeded` | `{ challengeId, handle, problem, expiresAt, serverTime }` |
| `handleVerified` | `{ handle, verifyToken }`, token is saved in localStorage |
| `verificationCancelled` | time ran out or nothing to verify |
| `joinedRoom` | `{ roomId, token }`, token is saved in sessionStorage |
| `roomState` | full state for this player |
| `teamCodeUpdate` | `{ playerId, username, problemId, code }` |
| `teamMessage` / `disturbMessage` | one chat message |
| `submissionsChecked` | manual refresh finished |
| `rejoinFailed` | room is gone, go back home |
| `errorMessage` | text to show the user |

Notice that the client never sends a `roomId` after joining. The server keeps a `socket.id -> player` map and uses that, so you can't send events into someone else's room.


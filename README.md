# CF Fight

CF Fight is a real-time competitive programming game where two teams compete to solve Codeforces problems before the timer runs out. Create a room, invite friends with the room code, pick a team, and start solving.

I built this project to make regular problem-solving more social: teammates can discuss ideas, see each other's code as they type, and keep an eye on the other team's progress while the match is running.

## What it does

- **Game rooms:** One player creates a room and shares its code with others.
- **Two teams:** Players join Team A or Team B, with a maximum of three players per team.
- **Random problem set:** When the host starts the match, the backend selects six problems file. Players cannot choose the problem set themselves.
- **30-minute matches:** A shared timer runs for each game. The team that solves more distinct problems wins; equal scores result in a draw.
- **Codeforces profile checks:** Players enter a Codeforces handle, which is checked through the Codeforces API. The app also retrieves the profile rating when it is available.
- **Live code sharing:** The built-in Monaco editor lets teammates see each other's code updates in real time.
- **Team chat and cross-team messages:** Coordinate with your teammates or send messages to the other side during a match.
- **Submission tracking:** After you submit a solution on Codeforces, CF Fight checks recent submissions and updates the verdict and team score when it detects an accepted solution.

## How a match works

1. Create a room and share the room code.
2. Each player joins with a username and Codeforces handle.
3. Players choose Team A or Team B. Each team can have up to three members, and both teams need at least one player to begin.
4. The room host starts the game. The server chooses six problems and starts the 30-minute timer.
5. Work on a problem in the editor, share code and ideas with teammates, then open Codeforces to submit your solution.
6. CF Fight checks the submissions and updates the scores. The game ends when the timer expires.

## Tech stack

**Frontend**
- React
- Vite
- Monaco Editor (`@monaco-editor/react`)
- Socket.IO Client

**Backend**
- Node.js
- Express
- Socket.IO
- CORS and dotenv

**External service**
- Codeforces API for handle validation, profile information, and submission status

## Run it locally

You will need Node.js and npm installed. The frontend and backend have separate `package.json` files, so install and run them separately.

### 1. Clone the repository

```bash
git clone https://github.com/Junaid01274/CPFight.git
cd CPFight
```

### 2. Start the backend

```bash
cd backend
npm install
```

Create a file named `.env` inside `backend/`:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Then start the server:

```bash
npm run dev
```

The backend should be available at `http://localhost:5000`.

### 3. Start the frontend

Open a second terminal from the repository root and run:

```bash
cd frontend
npm install
```

Create a file named `.env` inside `frontend/`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

Start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

For a local setup, make sure `FRONTEND_URL` in the backend `.env` matches the address used by the frontend. If Vite starts on a different port, update that value as well.

## Project layout

```text
CPFight/
├── backend/
│   ├── server.js       # Express server, Socket.IO events, rooms and match logic
│   ├── problems.json   # Problems available for random selection
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx     # Main React interface
    │   └── socket.js   # Socket.IO client connection
    └── package.json
```

## A few things to know

- **Code is submitted on Codeforces.** The editor in CF Fight is for writing and sharing code; it does not compile or submit code directly. Use the provided Codeforces links to submit, then return to the room for the updated verdict.
- **The current version uses in-memory rooms.** There is no database for match state, so active rooms and their data are lost when the backend restarts. Players are also removed from a room when their socket disconnects.
- **Submission updates depend on the Codeforces API.** If Codeforces is slow or unavailable, verdicts may take longer to appear.


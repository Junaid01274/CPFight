const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const config = require("./src/config");
const app = require("./src/app");
const { loadProblems } = require("./src/problems");
const { registerSocketHandlers } = require("./src/socketHandlers");
const { startJobs } = require("./src/jobs");

let problems;
try {
    problems = loadProblems(path.join(__dirname, "data", "problems.json"));
} catch (error) {
    console.error("Could not load problems.json:", error.message);
    process.exit(1);
}

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: config.FRONTEND_URL },
    maxHttpBufferSize: 256 * 1024
});

registerSocketHandlers(io, problems);
startJobs(io);

server.listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
    console.log(`Loaded ${problems.length} problems`);
    console.log(`Game length: ${config.GAME_DURATION_MS / 60000} minutes`);
});

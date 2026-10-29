const config = require("./config");
const store = require("./roomStore");
const codeforces = require("./codeforces");
const game = require("./room");
const verify = require("./verify");
const { pickRandomProblems } = require("./problems");
const { sendState, emitToTeam, emitToRoom } = require("./broadcast");
const { checkSubmissions } = require("./submissions");
const {
    cleanString,
    checkPlayerInfo,
    normalizeRoomId,
    isValidRoomId
} = require("./validate");

function safe(handler) {
    return async (...args) => {
        try {
            await handler(...args);
        } catch (error) {
            console.error("Error in socket handler:", error);
        }
    };
}

function registerSocketHandlers(io, allProblems) {
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        let busy = false;

        function sendError(message) {
            socket.emit("errorMessage", message);
        }

        function getContext() {
            const info = store.getSocketInfo(socket.id);
            if (!info) {
                return null;
            }
            const room = store.getRoom(info.roomId);
            const player = room && game.findPlayer(room, info.playerId);
            if (!player) {
                return null;
            }
            return { room, player };
        }

        function enterRoom(room, player) {
            store.linkSocket(socket.id, room.id, player.id);
            socket.emit("joinedRoom", { roomId: room.id, token: player.token });
            sendState(io, room);
        }

        function leaveCurrentRoom() {
            const context = getContext();
            store.unlinkSocket(socket.id);

            if (!context) {
                return;
            }

            const { room, player } = context;
            game.removePlayer(room, player.id);

            if (room.players.length === 0) {
                store.deleteRoom(room.id);
            } else {
                sendState(io, room);
            }
        }

        async function lookupHandle(handle) {
            try {
                const cfUser = await codeforces.getUserInfo(handle);
                if (!cfUser) {
                    sendError("Codeforces handle not found");
                    return null;
                }
                return cfUser;
            } catch (error) {
                console.log("user.info failed:", error.message);
                sendError("Could not reach Codeforces right now, please try again");
                return null;
            }
        }

        function createRoomNow(username, cfUser) {
            leaveCurrentRoom();

            const room = game.createRoom(store.generateRoomId());
            const player = game.createPlayer(socket.id, username, cfUser);
            game.addPlayer(room, player);
            store.addRoom(room);

            enterRoom(room, player);
            console.log(`Room ${room.id} created by ${player.handle}`);
        }

        function joinRoomNow(roomId, username, cfUser) {
            // the room may have filled up or started while we were waiting
            const room = store.getRoom(roomId);
            if (!room) {
                return sendError("Room does not exist");
            }

            const player = game.createPlayer(socket.id, username, cfUser);
            const addError = game.addPlayer(room, player);
            if (addError) {
                return sendError(addError);
            }

            leaveCurrentRoom();
            enterRoom(room, player);
            console.log(`${player.handle} joined ${room.id}`);
        }

        function runAction(action) {
            if (action.type === "create") {
                createRoomNow(action.username, action.cfUser);
            } else {
                joinRoomNow(action.roomId, action.username, action.cfUser);
            }
        }

        function verifyThenRun(action, verifyToken) {
            const handle = action.cfUser.handle;

            if (!config.VERIFY_HANDLES || verify.isRemembered(verifyToken, handle)) {
                runAction(action);
                return;
            }

            const challenge = verify.createChallenge(handle, allProblems);
            verify.savePending(challenge, action);

            socket.emit("verificationNeeded", {
                challengeId: challenge.id,
                handle,
                problem: challenge.problem,
                expiresAt: challenge.expiresAt,
                serverTime: Date.now()
            });
        }

        socket.on("createRoom", safe(async (data) => {
            const username = cleanString(data?.username);
            const handle = cleanString(data?.handle);

            const error = checkPlayerInfo(username, handle);
            if (error) {
                return sendError(error);
            }
            if (busy) {
                return;
            }

            busy = true;
            try {
                const cfUser = await lookupHandle(handle);
                if (!cfUser || !socket.connected) {
                    return;
                }
                verifyThenRun({ type: "create", username, cfUser }, cleanString(data?.verifyToken));
            } finally {
                busy = false;
            }
        }));

        socket.on("joinRoom", safe(async (data) => {
            const roomId = normalizeRoomId(data?.roomId);
            const username = cleanString(data?.username);
            const handle = cleanString(data?.handle);

            if (!isValidRoomId(roomId)) {
                return sendError("Room ID should be 5 letters or numbers");
            }

            const error = checkPlayerInfo(username, handle);
            if (error) {
                return sendError(error);
            }

            const joinError = game.canJoin(store.getRoom(roomId));
            if (joinError) {
                return sendError(joinError);
            }
            if (busy) {
                return;
            }

            busy = true;
            try {
                const cfUser = await lookupHandle(handle);
                if (!cfUser || !socket.connected) {
                    return;
                }
                verifyThenRun({ type: "join", roomId, username, cfUser }, cleanString(data?.verifyToken));
            } finally {
                busy = false;
            }
        }));

        socket.on("checkVerification", safe(async (data) => {
            const challengeId = cleanString(data?.challengeId);
            const entry = verify.getPending(challengeId);
            if (!entry) {
                socket.emit("verificationCancelled", "Nothing to verify, please start again");
                return;
            }

            const { action, challenge } = entry;
            const now = Date.now();

            if (verify.isExpired(challenge, now)) {
                verify.removePending(challengeId);
                socket.emit("verificationCancelled", "Time ran out, please try again");
                return;
            }
            if (busy) {
                return;
            }
            if (now - challenge.lastCheckAt < config.VERIFY_CHECK_COOLDOWN_MS) {
                return sendError("Wait a few seconds before checking again");
            }

            challenge.lastCheckAt = now;
            busy = true;
            try {
                let submissions;
                try {
                    submissions = await codeforces.getLastSubmissions(challenge.handle);
                } catch (error) {
                    console.log("user.status failed:", error.message);
                    return sendError("Could not reach Codeforces right now, please try again");
                }

                if (verify.getPending(challengeId) !== entry || !socket.connected) {
                    return;
                }

                if (!verify.hasProof(challenge, submissions)) {
                    return sendError("Didn't find the submission yet. Codeforces can take a few seconds, try again");
                }

                verify.removePending(challengeId);
                const verifyToken = verify.rememberHandle(challenge.handle);
                socket.emit("handleVerified", { handle: challenge.handle, verifyToken });
                console.log(`${challenge.handle} verified their handle`);

                runAction(action);
            } finally {
                busy = false;
            }
        }));

        socket.on("cancelVerification", safe((data) => {
            verify.removePending(cleanString(data?.challengeId));
        }));

        socket.on("rejoinRoom", safe((data) => {
            const room = store.getRoom(normalizeRoomId(data?.roomId));
            const player = room && game.findPlayerByToken(room, cleanString(data?.token));

            if (!player) {
                socket.emit("rejoinFailed", "Your previous room is no longer available");
                return;
            }

            if (player.connected && player.socketId !== socket.id) {
                store.unlinkSocket(player.socketId);
                io.to(player.socketId).emit("rejoinFailed", "You opened this room in another tab");
            }

            game.markReconnected(room, player, socket.id);
            enterRoom(room, player);
            console.log(`${player.handle} rejoined ${room.id}`);
        }));

        socket.on("leaveRoom", safe(() => {
            leaveCurrentRoom();
        }));

        socket.on("joinTeam", safe((team) => {
            const context = getContext();
            if (!context) {
                return;
            }

            const error = game.joinTeam(context.room, context.player, team);
            if (error) {
                return sendError(error);
            }
            sendState(io, context.room);
        }));

        socket.on("startGame", safe(() => {
            const context = getContext();
            if (!context) {
                return;
            }

            const problems = pickRandomProblems(allProblems, config.PROBLEMS_PER_GAME);
            const error = game.startGame(context.room, context.player, problems);
            if (error) {
                return sendError(error);
            }

            sendState(io, context.room);
            console.log(`Game started in ${context.room.id}`);
        }));

        socket.on("selectProblem", safe((problemId) => {
            const context = getContext();
            if (context && game.selectProblem(context.room, context.player, problemId)) {
                sendState(io, context.room);
            }
        }));

        socket.on("codeUpdate", safe((data) => {
            const context = getContext();
            if (!context) {
                return;
            }

            const { room, player } = context;
            const error = game.updateCode(room, player, data?.problemId, data?.code);
            if (error) {
                return sendError(error);
            }

            emitToTeam(io, room, player.team, "teamCodeUpdate", {
                playerId: player.id,
                username: player.username,
                problemId: data.problemId,
                code: data.code
            }, player.id);
        }));

        socket.on("sendTeamMessage", safe((rawText) => {
            const context = getContext();
            if (!context) {
                return;
            }

            const { room, player } = context;
            const text = cleanString(rawText);
            const message = game.addTeamMessage(room, player, text);
            if (!message) {
                if (text) sendError("You are sending messages too fast");
                return;
            }
            emitToTeam(io, room, player.team, "teamMessage", message);
        }));

        socket.on("sendDisturbMessage", safe((rawText) => {
            const context = getContext();
            if (!context) {
                return;
            }

            const text = cleanString(rawText);
            const message = game.addDisturbMessage(context.room, context.player, text);
            if (!message) {
                if (text) sendError("You are sending messages too fast");
                return;
            }
            emitToRoom(io, context.room, "disturbMessage", message);
        }));

        socket.on("refreshSubmissions", safe(async () => {
            const context = getContext();
            if (!context || context.room.status !== "running") {
                return;
            }

            const { room } = context;
            const now = Date.now();
            const waitMs = room.lastManualRefresh + config.MANUAL_REFRESH_COOLDOWN_MS - now;

            if (waitMs > 0) {
                sendError(`Please wait ${Math.ceil(waitMs / 1000)}s before refreshing again`);
                socket.emit("submissionsChecked");
                return;
            }

            room.lastManualRefresh = now;
            await checkSubmissions(io, room);
            socket.emit("submissionsChecked");
        }));

        socket.on("disconnect", safe(() => {
            console.log("User disconnected:", socket.id);

            const context = getContext();
            store.unlinkSocket(socket.id);

            if (!context) {
                return;
            }

            game.markDisconnected(context.room, context.player);
            sendState(io, context.room);
        }));
    });
}

module.exports = {
    registerSocketHandlers
};

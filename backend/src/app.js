const express = require("express");
const cors = require("cors");
const config = require("./config");
const store = require("./roomStore");

const app = express();

app.use(cors({ origin: config.FRONTEND_URL }));
app.use(express.json());

app.get("/", (req, res) => {
    res.send("CF Battle backend is running");
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        rooms: store.getAllRooms().length,
        uptimeSeconds: Math.round(process.uptime())
    });
});

module.exports = app;

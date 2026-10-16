
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = new Map();

app.get("/", (req, res) => {
  res.send("Animal FUT Multiplayer server is online!");
});

app.get("/health", (req, res) => {
  res.json({ online: true });
});

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = "";
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));

  return code;
}

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);

  socket.leave(code);
  delete socket.data.roomCode;

  if (!room) return;

  room.players = room.players.filter(
    id => id !== socket.id
  );

  if (room.players.length === 0) {
    rooms.delete(code);
  } else {
    io.to(code).emit("room-update", {
      code,
      players: room.players.length
    });

    io.to(code).emit("opponent-left");
  }
}

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("create-room", callback => {
    leaveRoom(socket);

    const code = generateRoomCode();

    rooms.set(code, {
      players: [socket.id]
    });

    socket.join(code);
    socket.data.roomCode = code;

    if (typeof callback === "function") {
      callback({ ok: true, code });
    }

    io.to(code).emit("room-update", {
      code,
      players: 1
    });

    console.log("Room created:", code);
  });

  socket.on("join-room", (rawCode, callback) => {
    const code = String(rawCode || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Soba ne postoji."
        });
      }
      return;
    }

    if (room.players.length >= 2) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Soba je puna."
        });
      }
      return;
    }

    leaveRoom(socket);

    room.players.push(socket.id);
    socket.join(code);
    socket.data.roomCode = code;

    if (typeof callback === "function") {
      callback({ ok: true, code });
    }

    io.to(code).emit("room-update", {
      code,
      players: room.players.length
    });

    if (room.players.length === 2) {
      io.to(code).emit("match-ready", {
        message: "Oba igrača su u sobi."
      });
    }

    console.log("Player joined:", code);
  });

  socket.on("leave-room", () => {
    leaveRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

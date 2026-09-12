import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";

interface LobbyPlayer {
  id: string; // socket ID
  name: string;
  playerId: number; // 1 (Blue), 2 (Red), 3 (Yellow), 4 (Purple)
  isHost: boolean;
  isReady: boolean;
}

interface Lobby {
  id: string;
  name: string;
  hostId: string;
  password?: string;
  maxPlayers: number; // 2, 3, or 4
  startingGold: number;
  status: 'waiting' | 'in_game';
  players: LobbyPlayer[];
  createdAt: number;
}

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// Memory storage for lobbies
const lobbies = new Map<string, Lobby>();

// Helper to sanitize lobby list for public display
function getPublicLobbies() {
  return Array.from(lobbies.values()).map(l => ({
    id: l.id,
    name: l.name,
    hostName: l.players.find(p => p.isHost)?.name || "فرمانده",
    maxPlayers: l.maxPlayers,
    currentPlayers: l.players.length,
    hasPassword: !!l.password && l.password.trim().length > 0,
    startingGold: l.startingGold,
    status: l.status,
    createdAt: l.createdAt
  }));
}

// Find next available playerId slot (1 to maxPlayers)
function getNextAvailableSlot(lobby: Lobby): number {
  const usedSlots = new Set(lobby.players.map(p => p.playerId));
  for (let slot = 1; slot <= lobby.maxPlayers; slot++) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }
  return 1;
}

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Ping handler for latency measurement
  socket.on("ping", (callback?: (ts: number) => void) => {
    if (typeof callback === "function") {
      callback(Date.now());
    } else {
      socket.emit("pong", { timestamp: Date.now() });
    }
  });

  // Send initial list of active lobbies
  socket.emit("lobby:list", getPublicLobbies());

  // Request refreshed lobby list
  socket.on("lobby:refresh", () => {
    socket.emit("lobby:list", getPublicLobbies());
  });

  // Create Lobby
  socket.on("lobby:create", (data: {
    name: string;
    password?: string;
    maxPlayers: number;
    startingGold: number;
    hostName: string;
  }) => {
    const lobbyId = `lobby_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const startingGold = [300, 500, 1000, 2000, 5000].includes(data.startingGold) ? data.startingGold : 500;
    const maxPlayers = [2, 3, 4].includes(data.maxPlayers) ? data.maxPlayers : 4;
    const lobbyName = (data.name && data.name.trim().length > 0) ? data.name.trim() : `لابی ${data.hostName || "فرمانده"}`;

    const hostPlayer: LobbyPlayer = {
      id: socket.id,
      name: data.hostName || "میزبان",
      playerId: 1, // Host defaults to Player 1 (Blue)
      isHost: true,
      isReady: true,
    };

    const newLobby: Lobby = {
      id: lobbyId,
      name: lobbyName,
      hostId: socket.id,
      password: data.password ? data.password.trim() : undefined,
      maxPlayers,
      startingGold,
      status: 'waiting',
      players: [hostPlayer],
      createdAt: Date.now()
    };

    lobbies.set(lobbyId, newLobby);
    socket.join(lobbyId);

    // Confirm joined to creator
    socket.emit("lobby:joined", {
      lobby: newLobby,
      selfPlayerId: 1
    });

    // Broadcast updated lobby list to everyone
    io.emit("lobby:list", getPublicLobbies());
  });

  // Join existing lobby
  socket.on("lobby:join", (data: { lobbyId: string; password?: string; playerName: string }, callback?: (res: { success: boolean; error?: string }) => void) => {
    const lobby = lobbies.get(data.lobbyId);

    if (!lobby) {
      if (callback) callback({ success: false, error: "لابی مورد نظر یافت نشد!" });
      return;
    }

    if (lobby.status !== 'waiting') {
      if (callback) callback({ success: false, error: "این بازی قبلاً شروع شده است!" });
      return;
    }

    if (lobby.players.length >= lobby.maxPlayers) {
      if (callback) callback({ success: false, error: "ظرفیت لابی تکمیل است!" });
      return;
    }

    if (lobby.password && lobby.password.trim().length > 0) {
      if (!data.password || data.password.trim() !== lobby.password.trim()) {
        if (callback) callback({ success: false, error: "رمز ورود به لابی اشتباه است!" });
        return;
      }
    }

    const assignedSlot = getNextAvailableSlot(lobby);
    const newPlayer: LobbyPlayer = {
      id: socket.id,
      name: data.playerName || `بازیکن ${assignedSlot}`,
      playerId: assignedSlot,
      isHost: false,
      isReady: false
    };

    lobby.players.push(newPlayer);
    socket.join(lobby.id);

    socket.emit("lobby:joined", {
      lobby,
      selfPlayerId: assignedSlot
    });

    io.to(lobby.id).emit("lobby:updated", lobby);
    io.emit("lobby:list", getPublicLobbies());

    if (callback) callback({ success: true });
  });

  // Rejoin ongoing game match
  socket.on("lobby:rejoin", (data: { lobbyId: string; playerName?: string; targetPlayerId?: number }, callback?: (res: { success: boolean; selfPlayerId?: number; error?: string }) => void) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby) {
      if (callback) callback({ success: false, error: "لابی نبرد یافت نشد یا منقضی شده است!" });
      return;
    }

    // Determine slot to reconnect into
    let rejoiningSlot = data.targetPlayerId;
    let existingPlayer = lobby.players.find(p => (rejoiningSlot && p.playerId === rejoiningSlot) || (data.playerName && p.name === data.playerName));

    if (existingPlayer) {
      existingPlayer.id = socket.id;
      if (data.playerName) existingPlayer.name = data.playerName;
      rejoiningSlot = existingPlayer.playerId;
    } else {
      rejoiningSlot = getNextAvailableSlot(lobby);
      const newPlayer: LobbyPlayer = {
        id: socket.id,
        name: data.playerName || `فرمانده ${rejoiningSlot}`,
        playerId: rejoiningSlot,
        isHost: lobby.players.length === 0,
        isReady: true
      };
      lobby.players.push(newPlayer);
      if (lobby.players.length === 1) {
        lobby.hostId = socket.id;
      }
    }

    socket.join(lobby.id);

    // Notify caller
    socket.emit("game:rejoined", {
      lobby,
      selfPlayerId: rejoiningSlot
    });

    // Notify lobby and ask host to send immediate full state sync
    socket.to(lobby.id).emit("game:request_sync", { requesterId: socket.id });
    io.to(lobby.id).emit("lobby:updated", lobby);
    io.to(lobby.id).emit("game:chat_message", {
      sender: "سیستم تاکتیکال",
      message: `فرمانده ${data.playerName || existingPlayer?.name || 'مجدد'} با موفقیت به میدان نبرد متصل شد.`,
      playerId: 0,
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    });

    io.emit("lobby:list", getPublicLobbies());
    if (callback) callback({ success: true, selfPlayerId: rejoiningSlot });
  });

  // Update Player Profile / Name in Lobby
  socket.on("lobby:update_player_name", (data: { lobbyId?: string; newName: string }) => {
    if (!data.newName || !data.newName.trim()) return;
    const cleanName = data.newName.trim().slice(0, 20);

    lobbies.forEach(lobby => {
      const p = lobby.players.find(player => player.id === socket.id);
      if (p) {
        p.name = cleanName;
        io.to(lobby.id).emit("lobby:updated", lobby);
      }
    });
    io.emit("lobby:list", getPublicLobbies());
  });

  // Update Lobby Settings (Host only)
  socket.on("lobby:update_settings", (data: { lobbyId: string; name?: string; startingGold?: number; maxPlayers?: number }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.hostId !== socket.id) return;

    if (data.name && data.name.trim().length > 0) {
      lobby.name = data.name.trim();
    }
    if (data.startingGold && [300, 500, 1000, 2000, 5000].includes(data.startingGold)) {
      lobby.startingGold = data.startingGold;
    }
    if (data.maxPlayers && [2, 3, 4].includes(data.maxPlayers) && data.maxPlayers >= lobby.players.length) {
      lobby.maxPlayers = data.maxPlayers;
    }

    io.to(lobby.id).emit("lobby:updated", lobby);
    io.emit("lobby:list", getPublicLobbies());
  });

  // Player Change Slot / Color
  socket.on("lobby:change_slot", (data: { lobbyId: string; newSlot: number }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.status !== 'waiting') return;

    if (data.newSlot < 1 || data.newSlot > lobby.maxPlayers) return;

    const isSlotTaken = lobby.players.some(p => p.playerId === data.newSlot && p.id !== socket.id);
    if (isSlotTaken) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (player) {
      player.playerId = data.newSlot;
      socket.emit("lobby:slot_changed", { newSlot: data.newSlot });
      io.to(lobby.id).emit("lobby:updated", lobby);
    }
  });

  // Toggle Ready Status
  socket.on("lobby:toggle_ready", (data: { lobbyId: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.status !== 'waiting') return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      io.to(lobby.id).emit("lobby:updated", lobby);
    }
  });

  // Lobby Chat
  socket.on("lobby:chat", (data: { lobbyId: string; message: string; senderName: string }) => {
    if (!data.lobbyId || !data.message.trim()) return;
    io.to(data.lobbyId).emit("lobby:chat_message", {
      sender: data.senderName,
      message: data.message.trim(),
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Host Starts Game
  socket.on("lobby:start_game", (data: { lobbyId: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.hostId !== socket.id) return;

    lobby.status = 'in_game';
    io.to(lobby.id).emit("game:start", {
      lobby
    });
    io.emit("lobby:list", getPublicLobbies());
  });

  // Leave Lobby
  const handleLeaveLobby = () => {
    lobbies.forEach((lobby, lobbyId) => {
      const pIdx = lobby.players.findIndex(p => p.id === socket.id);
      if (pIdx !== -1) {
        const leavingPlayer = lobby.players[pIdx];
        lobby.players.splice(pIdx, 1);
        socket.leave(lobbyId);

        if (lobby.players.length === 0) {
          lobbies.delete(lobbyId);
        } else {
          // If in an active game, notify match participants
          if (lobby.status === 'in_game') {
            io.to(lobbyId).emit("game:player_left", {
              playerId: leavingPlayer.playerId,
              name: leavingPlayer.name,
              isHost: leavingPlayer.isHost
            });

            io.to(lobbyId).emit("game:chat_message", {
              sender: "سیستم تاکتیکال",
              message: `فرمانده ${leavingPlayer.name} از میدان نبرد عقب‌نشینی کرد.`,
              playerId: 0,
              time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
            });
          }

          // If host left, assign new host and notify
          if (leavingPlayer.isHost) {
            lobby.players[0].isHost = true;
            lobby.players[0].isReady = true;
            lobby.hostId = lobby.players[0].id;

            if (lobby.status === 'in_game') {
              io.to(lobbyId).emit("game:host_migrated", {
                newHostId: lobby.hostId,
                newHostPlayerId: lobby.players[0].playerId,
                newHostName: lobby.players[0].name
              });
            }
          }
          io.to(lobbyId).emit("lobby:updated", lobby);
        }
        io.emit("lobby:list", getPublicLobbies());
      }
    });
  };

  socket.on("lobby:leave", handleLeaveLobby);
  socket.on("disconnect", handleLeaveLobby);

  // --- In-Game Real-Time Action Relays ---
  socket.on("game:command", (data: { lobbyId: string; command: any }) => {
    socket.to(data.lobbyId).emit("game:command", data.command);
  });

  socket.on("game:train_unit", (data: { lobbyId: string; action: any }) => {
    socket.to(data.lobbyId).emit("game:train_unit", data.action);
  });

  socket.on("game:place_building", (data: { lobbyId: string; action: any }) => {
    socket.to(data.lobbyId).emit("game:place_building", data.action);
  });

  socket.on("game:repair_building", (data: { lobbyId: string; action: any }) => {
    socket.to(data.lobbyId).emit("game:repair_building", data.action);
  });

  socket.on("game:trade_resource", (data: { lobbyId: string; action: any }) => {
    socket.to(data.lobbyId).emit("game:trade_resource", data.action);
  });

  // Projectile Relay (Mortars, cannonballs, bullets, RPGs, tower arrows)
  socket.on("game:projectile", (data: { lobbyId: string; projectile: any }) => {
    socket.to(data.lobbyId).emit("game:projectile", data.projectile);
  });

  // Reconnection / State recovery request
  socket.on("game:request_sync", (data: { lobbyId: string }) => {
    socket.to(data.lobbyId).emit("game:request_sync", { requesterId: socket.id });
  });

  // Player Defeat Relay
  socket.on("game:player_defeat", (data: { lobbyId: string; defeatedPlayerId: number; defeatedName: string }) => {
    io.to(data.lobbyId).emit("game:player_defeat", data);
  });

  // Host sends periodic state sync snapshot to ensure identical physical world state across clients
  socket.on("game:sync_state", (data: { lobbyId: string; state: any }) => {
    socket.to(data.lobbyId).emit("game:sync_state", data.state);
  });

  // In-game Chat
  socket.on("game:chat", (data: { lobbyId: string; message: string; senderName: string; playerId: number }) => {
    io.to(data.lobbyId).emit("game:chat_message", {
      sender: data.senderName,
      message: data.message,
      playerId: data.playerId,
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    });
  });
});

async function startServer() {
  // API route
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", activeLobbies: lobbies.size });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

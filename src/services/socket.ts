import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    // Connect to current location origin
    socketInstance = io(window.location.origin, {
      autoConnect: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      console.log("Connected to Socket.io server:", socketInstance?.id);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("Disconnected from Socket.io server:", reason);
    });
  }
  return socketInstance;
}

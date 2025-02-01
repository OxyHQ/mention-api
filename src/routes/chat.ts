import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";

const router = Router();

export default (io: SocketIOServer) => {
  io.on("connection", (socket) => {
    socket.on("sendMessage", async (data) => {
      try {
        const newMessage = {
          ...data,
          createdAt: new Date(),
          isSent: false,
        };
        console.log("New message:", newMessage);
        io.emit("message", newMessage); // broadcast to all clients
      } catch (err) {
        console.error("Error saving message:", err);
      }
    });
  });

  return router;
};

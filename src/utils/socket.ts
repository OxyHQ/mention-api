import { Server as SocketIOServer } from "socket.io";
import Session from "../models/Session";
import User from "../models/User";

const socketUtils = (io: SocketIOServer) => {
  io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("login", async (data) => {
      const { userId, device, ip, token, expiresAt } = data;
      try {
        const user = await User.findById(userId);
        if (!user) {
          return socket.emit("error", { message: "User not found" });
        }

        const newSession = new Session({ userId, device, ip, token, expiresAt });
        await newSession.save();

        user.sessions.push(newSession);
        await user.save();

        socket.emit("loginSuccess", { message: "Login successful", session: newSession });
      } catch (error) {
        socket.emit("error", { message: "Error during login", error });
      }
    });

    socket.on("logout", async (data) => {
      const { token } = data;
      try {
        const session = await Session.findOne({ token });
        if (!session) {
          return socket.emit("error", { message: "Session not found" });
        }

        await session.remove();
        socket.emit("logoutSuccess", { message: "Logout successful" });
      } catch (error) {
        socket.emit("error", { message: "Error during logout", error });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });
};

export default socketUtils;

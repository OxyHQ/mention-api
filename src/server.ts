import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import postsRouter from "./routes/posts";
import profilesRouter from "./routes/profiles";
import usersRouter from "./routes/users";
import dotenv from "dotenv";
import fileRoutes from "./routes/files";
import listsRoutes from "./routes/lists";
import hashtagsRoutes from "./routes/hashtags";
import chat from "./routes/chat";
import authRouter from "./routes/auth";
import { authenticateToken, authorizeRoles, revokeToken, checkSessionExpiration } from "./middleware/auth";
import { rateLimiter, bruteForceProtection, csrfProtection } from "./middleware/security";
import { mfaMiddleware } from "./middleware/mfa";
import socketUtils from "./utils/socket";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(rateLimiter);
app.use(bruteForceProtection);
app.use(csrfProtection);
app.use(mfaMiddleware);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Socket.IO Connection
socketUtils(io);

// API Routes
app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the API" });
});

app.use("/api/posts", postsRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/users", usersRouter);
app.use("/api/files", fileRoutes);
app.use("/api/lists", listsRoutes);
app.use("/api/hashtags", hashtagsRoutes);
app.use("/api/chat", chat(io));
app.use("/api/auth", authRouter);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

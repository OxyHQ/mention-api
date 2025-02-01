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

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Socket.IO Connection
io.on("connection", (socket) => {
  console.log("Client connected");
  

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

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

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

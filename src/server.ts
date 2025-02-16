import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server as SocketIOServer, Socket } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import postsRouter from "./routes/posts";
import profilesRouter from "./routes/profiles";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import notificationsRouter from "./routes/notifications";
import dotenv from "dotenv";
import fileRoutes from "./routes/files";
import listsRoutes from "./routes/lists";
import hashtagsRoutes from "./routes/hashtags";
import createChatRouter from "./routes/chat";
import User from "./models/User";
import Post from "./models/Post";
import searchRoutes from "./routes/search";
import { rateLimiter, bruteForceProtection } from "./middleware/security";
import Notification from "./models/Notification";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Custom socket interface to include user property
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    [key: string]: any;
  };
}

// Socket token verification middleware
const verifySocketToken = (socket: any, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication token required"));
  }
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "default_secret");
    socket.user = decoded;
    return next();
  } catch (error) {
    return next(new Error("Invalid authentication token"));
  }
};

// Initialize Socket.IO with CORS configuration
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Content-Length", "Accept", "Accept-Encoding", "Accept-Language"],
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
  path: "/socket.io",
});

// Create namespaces
const chatNamespace = io.of("/chat");
const notificationsNamespace = io.of("/notifications");

// Configure notifications namespace
notificationsNamespace.use(verifySocketToken);
notificationsNamespace.on("connection", (socket: AuthenticatedSocket) => {
  console.log("Client connected to notifications namespace from ip:", socket.handshake.address);
  if (!socket.user?.id) {
    console.log("Unauthenticated client attempted to connect to notifications namespace");
    socket.disconnect(true);
    return;
  }
  const userRoom = `user:${socket.user.id}`;
  const userId = socket.user.id;
  socket.join(userRoom);
  console.log(`Client ${socket.id} joined notification room:`, userRoom);

  socket.on("markNotificationRead", async ({ notificationId }) => {
    try {
      if (!socket.user?.id) return;
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipientId: userId },
        { read: true },
        { new: true }
      ).populate("actorId", "username name avatar");
      if (notification) {
        notificationsNamespace.to(userRoom).emit("notificationUpdated", notification);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  });

  socket.on("markAllNotificationsRead", async () => {
    try {
      if (!socket.user?.id) return;
      await Notification.updateMany({ recipientId: userId }, { read: true });
      notificationsNamespace.to(userRoom).emit("allNotificationsRead");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected from notifications namespace`);
    socket.leave(userRoom);
  });
});

// Store namespaces in app for route access
app.set("io", io);
app.set("chatNamespace", chatNamespace);
app.set("notificationsNamespace", notificationsNamespace);

// Set up chat routes with socket namespace
app.use("/api/chat", createChatRouter(chatNamespace));

// Configure main namespace
io.use(verifySocketToken);
io.on("connection", (socket: AuthenticatedSocket) => {
  console.log("Client connected from ip:", socket.handshake.address);
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
  socket.on("joinPost", (postId: string) => {
    const room = `post:${postId}`;
    socket.join(room);
    console.log(`Client ${socket.id} joined room:`, room);
  });
  socket.on("leavePost", (postId: string) => {
    const room = `post:${postId}`;
    socket.leave(room);
    console.log(`Client ${socket.id} left room:`, room);
  });
});

// Logging for file upload requests
app.use("/api/files/upload", (req, res, next) => {
  if (req.method === "POST") {
    console.log("Incoming file upload request:", {
      method: req.method,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"],
      origin: req.headers.origin,
      authorization: !!req.headers.authorization,
    });
  }
  next();
});

app.use("/api/files", fileRoutes);

// Rate limiting and brute force protection
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/files/upload")) {
    rateLimiter(req, res, next);
  } else {
    next();
  }
});
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/files/upload")) {
    bruteForceProtection(req, res, next);
  } else {
    next();
  }
});

// Body parsing middleware
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/files/upload")) {
    express.json()(req, res, next);
  } else {
    next();
  }
});
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/files/upload")) {
    express.urlencoded({ extended: true })(req, res, next);
  } else {
    next();
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "", {
  autoIndex: true,
  autoCreate: true,
});
const db = mongoose.connection;
db.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});
db.once("open", () => {
  console.log("Connected to MongoDB successfully");
});
db.once("open", () => {
  require("./models/User");
  require("./models/Profile");
  require("./models/Post");
});

// API Routes
app.get("/api", async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    const postsCount = await Post.countDocuments();
    res.json({
      message: "Welcome to the API",
      users: usersCount,
      posts: postsCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats", error });
  }
});
app.use("/api/search", searchRoutes);
app.use("/api/posts", postsRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/users", usersRouter);
app.use("/api/lists", listsRoutes);
app.use("/api/hashtags", hashtagsRoutes);
app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationsRouter);

// Only call listen if this module is run directly
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default server;
export { io, chatNamespace, notificationsNamespace };

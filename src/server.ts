import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server as SocketIOServer, Socket } from "socket.io";
import cors from "cors";
import jwt from 'jsonwebtoken';
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
import { rateLimiter, bruteForceProtection, csrfProtection, parseCookies, csrfErrorHandler } from "./middleware/security";
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
    return next(new Error('Authentication token required'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'default_secret');
    socket.user = decoded;
    return next();
  } catch (error) {
    return next(new Error('Invalid authentication token'));
  }
};

// Initialize Socket.IO with CORS configuration
const io = new SocketIOServer(server, {
  cors: {
    origin: ["http://localhost:8081", "http://localhost:8082", "http://localhost:19006"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'Accept', 'Accept-Encoding', 'Accept-Language'],
  },
  allowEIO3: true,
  transports: ['websocket'],
  path: '/socket.io',
  pingTimeout: 60000,
  pingInterval: 25000
});

// Error handling for main socket server
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.code, err.message, err.context);
});

// Create namespaces
const chatNamespace = io.of('/chat');
const notificationsNamespace = io.of('/notifications');

// Configure notification namespace
notificationsNamespace.use((socket: any, next) => {
  console.log("Authenticating notification socket connection...");
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log("Missing auth token");
    return next(new Error('Authentication token required'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'default_secret');
    if (typeof decoded === 'string' || !decoded.id) {
      console.log("Invalid token payload");
      return next(new Error('Invalid token payload'));
    }
    socket.user = decoded;
    console.log("Notification socket authenticated for user:", socket.user.id);
    return next();
  } catch (error) {
    console.error("Notification socket auth error:", error);
    return next(new Error('Invalid authentication token'));
  }
});

// Handle notification socket connections
notificationsNamespace.on('connection', (socket: AuthenticatedSocket) => {
  console.log("Client connected to notifications namespace from ip:", socket.handshake.address);

  if (!socket.user?.id) {
    console.log("Unauthenticated client attempted to connect to notifications namespace");
    socket.disconnect(true);
    return;
  }

  const userRoom = `user:${socket.user.id}`;
  const userId = socket.user.id; // Store the ID to ensure it's available in closures
  socket.join(userRoom);
  console.log(`Client ${socket.id} joined notification room:`, userRoom);
  
  // Emit connection confirmation
  socket.emit('connected', { status: 'ok', userId: socket.user.id });

  socket.on("joinRoom", (room: string) => {
    // Add null check for socket.user
    if (!socket.user?.id) return;
    
    if (room === `user:${socket.user.id}`) {
      socket.join(room);
      console.log(`User ${socket.user.id} joined their notification room`);
    }
  });

  // Handle notification events
  socket.on("markNotificationRead", async ({ notificationId }) => {
    try {
      // Check if socket is still authenticated
      if (!socket.user?.id) return;

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipientId: userId },
        { read: true },
        { new: true }
      ).populate('actorId', 'username name avatar');

      if (notification) {
        notificationsNamespace.to(userRoom).emit("notificationUpdated", notification);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      socket.emit("error", { message: "Failed to mark notification as read" });
    }
  });

  socket.on("markAllNotificationsRead", async () => {
    try {
      // Check if socket is still authenticated
      if (!socket.user?.id) return;

      await Notification.updateMany(
        { recipientId: userId },
        { read: true }
      );
      notificationsNamespace.to(userRoom).emit("allNotificationsRead");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      socket.emit("error", { message: "Failed to mark all notifications as read" });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client ${socket.id} disconnected from notifications namespace. Reason:`, reason);
    socket.leave(userRoom);
  });

  socket.on("error", (error) => {
    console.error("Socket error for user", socket.user?.id, ":", error);
  });
});

// Store namespaces in app for route access
app.set('io', io);
app.set('chatNamespace', chatNamespace);
app.set('notificationsNamespace', notificationsNamespace);

// Set up chat routes with socket namespace
app.use('/api/chat', createChatRouter(chatNamespace));

// Configure main namespace
io.use(verifySocketToken);

// Socket.IO connection handling for main namespace
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

export { io, chatNamespace, notificationsNamespace }; // Export notificationsNamespace

// Configure CORS with credentials first
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8081", // Expo web default port
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'Accept', 'Accept-Encoding', 'Accept-Language']
}));

// Add special logging for file upload requests
app.use("/api/files/upload", (req, res, next) => {
  if (req.method === 'POST') {
    console.log("Incoming file upload request:", {
      method: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      origin: req.headers.origin,
      authorization: !!req.headers.authorization
    });
  }
  next();
});

// File routes before ANY other middleware
app.use("/api/files", fileRoutes);

// Cookie parser after file routes
app.use(parseCookies);

// Rate limiting and brute force protection after file routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/files/upload')) {
    rateLimiter(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/files/upload')) {
    bruteForceProtection(req, res, next);
  } else {
    next();
  }
});

// Body parsing middleware after file routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/files/upload')) {
    express.json()(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/files/upload')) {
    express.urlencoded({ extended: true })(req, res, next);
  } else {
    next();
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "", {
  autoIndex: true,
  autoCreate: true
});

const db = mongoose.connection;
db.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});
db.once("open", () => {
  console.log("Connected to MongoDB successfully");
});

// Initialize models after connection is established
db.once("open", () => {
  require("./models/User");
  require("./models/Profile");
  require("./models/Post");
  // ... other models
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

// Add CSRF error handler (should be after routes)
app.use(csrfErrorHandler);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import jwt from 'jsonwebtoken';
import postsRouter from "./routes/posts";
import profilesRouter from "./routes/profiles";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import dotenv from "dotenv";
import fileRoutes from "./routes/files";
import listsRoutes from "./routes/lists";
import hashtagsRoutes from "./routes/hashtags";
import chat from "./routes/chat";
import User from "./models/User";
import Post from "./models/Post";

// Import security middlewares
import { rateLimiter, bruteForceProtection, csrfProtection, parseCookies, csrfErrorHandler } from "./middleware/security";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO before routes
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:8081",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Socket.IO auth middleware
const verifySocketToken = (socket: any, next: any) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication token is required'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'default_secret');
    socket.user = decoded;
    return next();
  } catch (error) {
    return next(new Error('Invalid token'));
  }
};

io.use(verifySocketToken);

// Socket.IO connection handling
io.on("connection", (socket) => {
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

export { io };

// Configure CORS with credentials first
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8081", // Expo web default port
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

app.use("/api/posts", postsRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/users", usersRouter);
app.use("/api/lists", listsRoutes);
app.use("/api/hashtags", hashtagsRoutes);
app.use("/api/chat", chat(io));
app.use("/api/auth", authRouter);

// Add CSRF error handler (should be after routes)
app.use(csrfErrorHandler);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

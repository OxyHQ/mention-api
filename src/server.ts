import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors"; // Import cors
import itemsRouter from "./routes/items";
import postsRouter from "./routes/posts"; // Import postsRouter
import profilesRouter from "./routes/profiles"; // Import profilesRouter
import Item from "./models/Item";
import dotenv from "dotenv"; // Import dotenv

dotenv.config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

// Middleware
app.use(express.json());
app.use(cors()); // Use cors middleware

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
} as mongoose.ConnectOptions);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");

  Item.watch().on("change", (change) => {
    io.emit("itemsUpdate", change);
  });
});

// Socket.IO Connection
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// API Routes
app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the API" });
});

app.use("/api/items", itemsRouter);
app.use("/api/posts", postsRouter); // Use postsRouter
app.use("/api/profiles", profilesRouter); // Use profilesRouter

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

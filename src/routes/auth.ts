import express, { RequestHandler, Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Profile from "../models/Profile"; // Added import

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

// User signup API
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    // Check if user already exists
    const existing = await User.findOne({ $or: [{email}, {username}] });
    if (existing) return res.status(400).json({ message: "User already exists" });
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create user with type cast to any
    const newUser: any = await User.create({ username, email, password: hashedPassword });
    // Link profile with only the user id (as ObjectId and string)
    await Profile.create({ user: newUser._id, userID: newUser._id.toString() });
    return res.json({ message: "User signed up successfully", user: { id: newUser._id, username, email } });
  } catch (error) {
    return res.status(500).json({ message: "Signup error", error });
  }
});

// User signin API
router.post("/signin", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    // Find user by username
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });
    // Compare passwords
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid password" });
    // Generate token
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ message: "User signed in successfully", token });
  } catch (error) {
    return res.status(500).json({ message: "Signin error", error });
  }
});

// Account recovery API
router.post("/recover", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    // Check if email exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User with this email not found" });
    // Generate a dummy recovery token (in real apps, send email with secure link)
    const recoveryToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "15m" });
    // Simulate sending recovery email
    console.log(`Recovery email sent to ${email} with token: ${recoveryToken}`);
    return res.json({ message: "Recovery email has been sent", email, recoveryToken });
  } catch (error) {
    return res.status(500).json({ message: "Recovery error", error });
  }
});

export default router;
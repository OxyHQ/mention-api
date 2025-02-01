import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import csrf from "csurf";
import { body, validationResult } from "express-validator";
import User from "../models/User";
import Session from "../models/Session";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";
import { sendRecoveryEmail } from "../utils/email";
import { generateMfaCode, verifyMfaCode } from "../utils/mfa";
import { authenticateToken, authorizeRoles } from "../middleware/auth";
import { rateLimiter, bruteForceProtection } from "../middleware/security";
import { mfaMiddleware } from "../middleware/mfa";

const router = Router();
const csrfProtection = csrf({ cookie: true });

// User sign up
router.post(
  "/signup",
  [
    body("username").isLength({ min: 3 }),
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      const hashedPassword = await hashPassword(password);
      const newUser = new User({ username, email, password: hashedPassword, roles: ["user"], sessions: [] });
      await newUser.save();
      res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error creating user", error });
    }
  }
);

// User sign in
router.post(
  "/signin",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.json({ accessToken, refreshToken });
    } catch (error) {
      res.status(500).json({ message: "Error signing in", error });
    }
  }
);

// Password recovery
router.post(
  "/recover",
  [body("email").isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid email" });
      }

      const recoveryToken = generateAccessToken(user, "1h");
      await sendRecoveryEmail(email, recoveryToken);

      res.json({ message: "Recovery email sent" });
    } catch (error) {
      res.status(500).json({ message: "Error sending recovery email", error });
    }
  }
);

// Session management
router.get("/sessions", authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sessions", error });
  }
});

router.delete("/sessions/:sessionId", authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.userId.toString() !== req.user._id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await session.remove();
    res.json({ message: "Session revoked" });
  } catch (error) {
    res.status(500).json({ message: "Error revoking session", error });
  }
});

// Multi-Factor Authentication (MFA)
router.post("/mfa/setup", authenticateToken, async (req, res) => {
  try {
    const mfaCode = generateMfaCode();
    // Save MFA code to user or session
    res.json({ mfaCode });
  } catch (error) {
    res.status(500).json({ message: "Error setting up MFA", error });
  }
});

router.post("/mfa/verify", authenticateToken, async (req, res) => {
  const { mfaCode } = req.body;

  try {
    const isValid = verifyMfaCode(mfaCode);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid MFA code" });
    }

    res.json({ message: "MFA verified" });
  } catch (error) {
    res.status(500).json({ message: "Error verifying MFA", error });
  }
});

export default router;

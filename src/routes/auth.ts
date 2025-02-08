import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import Profile from "../models/Profile";

const router = express.Router();
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh_secret";

const generateTokens = (userId: string, username: string) => {
  const accessToken = jwt.sign(
    { id: userId, username },
    process.env.ACCESS_TOKEN_SECRET || "default_secret",
    { expiresIn: "1h" }
  );
  
  const refreshToken = jwt.sign(
    { id: userId, username },
    REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  
  return { accessToken, refreshToken };
};

// User signup API
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: "Missing required fields",
        details: {
          username: !username ? "Username is required" : null,
          email: !email ? "Email is required" : null,
          password: !password ? "Password is required" : null
        }
      });
    }

    // Check if user already exists
    const existing = await User.findOne({ $or: [{email}, {username}] });
    if (existing) {
      return res.status(400).json({ 
        message: existing.email === email ? "Email already in use" : "Username already taken" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user document with explicit field setting
    const userFields = {
      username,
      email,
      password: hashedPassword,
      bookmarks: [],
      refreshToken: null
    };

    console.log('Creating user with fields:', {
      ...userFields,
      password: '[HIDDEN]'
    });

    // Create new user instance
    const newUser = new User();
    Object.assign(newUser, userFields);

    // Double check all required fields are set
    console.log('Field presence check:', {
      hasUsername: !!newUser.username,
      hasEmail: !!newUser.email,
      hasPassword: !!newUser.password
    });

    // Validate the document
    const validationError = newUser.validateSync();
    if (validationError) {
      console.error('Validation errors:', validationError.errors);
      return res.status(400).json({
        message: "Validation error",
        errors: validationError.errors
      });
    }

    console.log('Model validation passed. Document to save:', {
      ...newUser.toObject(),
      password: '[HIDDEN]'
    });

    // Save with explicit error handling
    let savedUser;
    try {
      savedUser = await newUser.save();
      
      // Verify saved document has all fields
      const rawSavedDoc = await User.findById(savedUser._id)
        .select('+password +email +refreshToken')
        .lean();
      
      console.log('Raw saved document:', {
        ...rawSavedDoc,
        password: rawSavedDoc?.password ? '[PRESENT]' : '[MISSING]',
        email: rawSavedDoc?.email ? '[PRESENT]' : '[MISSING]'
      });

      if (!savedUser.email || !savedUser.password) {
        throw new Error("Critical fields missing after save");
      }

      console.log('User saved successfully. Saved document:', {
        ...savedUser.toObject(),
        password: '[HIDDEN]'
      });
    } catch (error) {
      throw new Error(`Error saving user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create associated profile
    await Profile.create({ 
      user: savedUser._id,
      userID: savedUser._id.toString(),
      name: { first: "", last: "" },
      avatar: "",
      associated: {
        lists: 0,
        feedgens: 0,
        starterPacks: 0,
        labeler: false
      },
      labels: [],
      description: "",
      banner: "",
      followersCount: 0,
      followsCount: 0,
      postsCount: 0,
      pinnedPosts: { id: "" },
      created_at: new Date(),
      indexedAt: new Date()
    });

    // Generate initial token
    const token = jwt.sign(
      { id: savedUser._id, username: savedUser.username },
      process.env.ACCESS_TOKEN_SECRET || "default_secret",
      { expiresIn: "24h" }
    );

    // Return success with sanitized user data
    return res.status(200).json({ 
      message: "User signed up successfully",
      token,
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ 
      message: "Signup error", 
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Enhanced signin route
router.post("/signin", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username }).select('+password') as IUser;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.username);
    
    // Store refresh token hash in user document
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = refreshTokenHash;
    await user.save();

    const profile = await Profile.findOne({ user: user._id });
    
    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: profile?.name || {},
        avatarSource: profile?.avatar ? { uri: profile.avatar } : null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login error", error });
  }
});

// New refresh token endpoint
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { id: string; username: string };
    const user = await User.findById(decoded.id).select('+refreshToken') as IUser;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify stored refresh token
    const isValidToken = await bcrypt.compare(refreshToken, user.refreshToken || '');
    if (!isValidToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokens = generateTokens(user._id.toString(), user.username);
    
    // Update stored refresh token
    const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    user.refreshToken = newRefreshTokenHash;
    await user.save();

    return res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token", error });
  }
});

// Logout endpoint
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token", error });
  }
});

// Validate session API
router.get("/validate", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "default_secret") as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ valid: true });
  } catch (error) {
    return res.status(401).json({ message: "Invalid token", error });
  }
});

export default router;
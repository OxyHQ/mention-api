import express, { RequestHandler, Router, Request, Response } from "express";
import User from "../models/User";
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get user ID by username
const getUserIDbyUsername: RequestHandler = async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            return res.status(400).json({ 
                message: "Username is required",
                details: "The username parameter is missing"
            });
        }
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(404).json({ 
                message: "User not found",
                details: `No user exists with username: ${username}`
            });
        }
        res.json({ id: user._id });
    } catch (error) {
        console.error("Error in getUserIDbyUsername:", error);
        res.status(500).json({ 
            message: "Error fetching user ID",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Get user by ID
const getUserByID: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching user", error });
    }
};

// Update a user by ID
const updateUser: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error updating user", error });
    }
};

// Public routes
router.get("/username-to-id/:username", getUserIDbyUsername);

// Protected routes
router.use(authMiddleware);
router.get("/:id", getUserByID);
router.put("/:id", updateUser);

export default router;
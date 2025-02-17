import express, { RequestHandler, Request } from "express";
import Profile from "../models/Profile";
import Followers from "../models/Followers";
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User";
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Update the profile schema to include location and website
const profileSchema = z.object({
  userID: z.string(),  // We'll convert this to ObjectId in the handler
  name: z.object({
    first: z.string().optional(),
    last: z.string().optional(),
  }),
  avatar: z.string().optional(),
  associated: z.object({
    lists: z.number().optional(),
    feedgens: z.number().optional(),
    starterPacks: z.number().optional(),
    labeler: z.boolean().optional(),
  }).optional(),
  labels: z.array(z.string()).optional(),
  description: z.string().optional(),
  banner: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
});

// Define the profile update schema with only editable fields
const profileUpdateSchema = z.object({
  name: z.object({
    first: z.string().optional(),
    last: z.string().optional(),
  }).optional(),
  avatar: z.string().optional(),
  description: z.string().optional(),
  banner: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
});

// Create a new profile
const createProfile: RequestHandler = async (req, res) => {
  try {
    const profileData = profileSchema.parse(req.body);
    
    if (!mongoose.Types.ObjectId.isValid(profileData.userID)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const userObjectId = new mongoose.Types.ObjectId(profileData.userID);
    
    // Check if profile already exists
    const existingProfile = await Profile.findOne({ userID: userObjectId });
    if (existingProfile) {
      return res.status(409).json({ message: "Profile already exists for this user" });
    }

    const newProfile = new Profile({
      ...profileData,
      userID: userObjectId,
      created_at: new Date()
    });

    await newProfile.save();
    res.status(201).json({ message: "Profile created successfully", profile: newProfile });
  } catch (error) {
    res.status(500).json({ message: "Error creating profile", error });
  }
};

//Get all profiles
const getProfiles: RequestHandler = async (req, res) => {
  try {
    const profiles = await Profile.find();
    const profilesWithUsernames = await Promise.all(
      profiles.map(async (profile) => {
        let username = "";
        // Replace API call with MongoDB lookup for username
        const user = await User.findById(profile.userID);
        if (user) {
          username = user.username;
        } else {
          console.error("User not found for user ID:", profile.userID);
        }
        return { ...profile.toObject(), username };
      })
    );
    res.json(profilesWithUsernames);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profiles", error });
  }
};

// Get a profile by ID with populated user data
const getProfileById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Strict ID validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: "Invalid user ID format",
        details: "The provided ID is not a valid MongoDB ObjectId"
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(id);
    const profile = await Profile.findOne({ userID: userObjectId });
    
    if (!profile) {
      return res.status(404).json({ 
        message: "Profile not found",
        details: "No profile exists for the provided user ID" 
      });
    }

    const user = await User.findById(userObjectId).select('username');
    if (!user) {
      return res.status(404).json({ 
        message: "User not found",
        details: "The associated user does not exist" 
      });
    }

    const followersCount = await Followers.countDocuments({ userID: userObjectId });
    const followingCount = await Followers.countDocuments({ contentID: userObjectId });
    
    const combinedData = {
      id: profile.userID.toString(), // Ensure ID is stringified
      ...profile.toObject(),
      username: user.username,
      joinDate: profile.created_at ? profile.created_at.toISOString() : "",
      _count: {
        followers: followersCount,
        following: followingCount,
        posts: profile._count?.posts || 0,
        karma: 0,
      },
    };

    res.json(combinedData);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      message: "Error fetching profile",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

//Get all followers by user ID
const getFollowers: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const followers = await Followers.find({ userID: id }).populate('userID', 'username avatar');
    const _count = await Followers.countDocuments({ userID: id });
    res.json({ followers, _count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching followers", error });
  }
};

//Get all following by user ID
const getFollowing: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const following = await Followers.find({ contentID: id }).populate('contentID', 'username avatar');
    const _count = await Followers.countDocuments({ contentID: id });
    res.json({ following, _count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching following", error });
  }
};

// Extend the Request type to include the user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

//Update a profile by ID
const updateProfile: RequestHandler = async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    // Only allow updating specific fields
    const updateData = profileUpdateSchema.parse(req.body);
    
    const profile = await Profile.findOne({ userID: id });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    // Ensure user can only update their own profile
    if (req.user?.id !== id) {
      res.status(403).json({ message: "Not authorized to update this profile" });
      return;
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { userID: id },
      { $set: updateData },
      { new: true }
    );

    // Get user data and counts
    const user = await User.findById(id).select('username');
    const followersCount = await Followers.countDocuments({ userID: id });
    const followingCount = await Followers.countDocuments({ contentID: id });

    const responseData = {
      ...updatedProfile?.toObject(),
      username: user?.username || "",
      _count: {
        followers: followersCount,
        following: followingCount,
        posts: updatedProfile?._count?.posts || 0,
        karma: 0,
      },
    };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error });
  }
};

router.post("/", createProfile);
router.get("/", getProfiles);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id", getProfileById);
router.patch("/:id", updateProfile);

export default router;

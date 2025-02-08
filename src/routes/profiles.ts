import express, { RequestHandler, Request } from "express";
import Profile from "../models/Profile";
import Followers from "../models/Followers";
import axios from "axios";
import { z } from "zod"; // Import zod for schema validation
import User from "../models/User"; // <-- Added User model import
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Define the profile schema using zod
const profileSchema = z.object({
  userID: z.string(),
  name: z.object({
    first: z.string().optional(),
    last: z.string().optional(),
  }),
  avatar: z.string(),
  associated: z.object({
    lists: z.number(),
    feedgens: z.number(),
    starterPacks: z.number(),
    labeler: z.boolean(),
  }),
  labels: z.array(z.string()),
  created_at: z.date(),
  description: z.string(),
  indexedAt: z.date(),
  banner: z.string(),
  followersCount: z.number(),
  followsCount: z.number(),
  postsCount: z.number(),
  pinnedPosts: z.object({
    id: z.string(),
  }),
  _count: z.object({
    followers: z.number(),
    following: z.number(),
    posts: z.number(),
  }),
});

const followersSchema = z.object({
  userID: z.string(),
  contentID: z.string(),
  created_at: z.date(),
  updatedAt: z.date(),
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
    const profileData = profileSchema.parse(req.body); // Validate request body
    const newProfile = new Profile(profileData);
    await newProfile.save();
    res.status(201).json({ message: "Profile created successfully" });
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
    const profile = await Profile.findOne({ userID: id });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const user = await User.findById(profile.userID).select('username');
    const followersCount = await Followers.countDocuments({ userID: id });
    const followingCount = await Followers.countDocuments({ contentID: id });
    const combinedData = {
      ...profile.toObject(),
      username: user?.username || "",
      _count: {
        followers: followersCount,
        following: followingCount,
        posts: profile._count?.posts || 0,
        karma: 0,
      },
    };

    res.json(combinedData);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error });
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

// Apply auth middleware to all routes
router.use(authMiddleware);

router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id", getProfileById);
router.patch("/:id", updateProfile);

export default router;

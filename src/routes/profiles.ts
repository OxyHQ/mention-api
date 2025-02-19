import express, { RequestHandler, Request } from "express";
import Profile from "../models/Profile";
import Follow from "../models/Follow";
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User";
import { authMiddleware } from '../middleware/auth';

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

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

    // Get follower and following counts using the Follow model
    const followersCount = await Follow.countDocuments({ followingId: userObjectId });
    const followingCount = await Follow.countDocuments({ followerId: userObjectId });
    
    const combinedData = {
      id: profile.userID.toString(),
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
    
    const followers = await Follow.find({ followingId: id })
      .populate('followerId', 'username avatar')
      .lean();
    
    const _count = await Follow.countDocuments({ followingId: id });
    
    res.json({ followers, _count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching followers", error });
  }
};

//Get all following by user ID
const getFollowing: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    const following = await Follow.find({ followerId: id })
      .populate('followingId', 'username avatar')
      .lean();
    
    const _count = await Follow.countDocuments({ followerId: id });
    
    res.json({ following, _count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching following", error });
  }
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
    const followersCount = await Follow.countDocuments({ followingId: id });
    const followingCount = await Follow.countDocuments({ followerId: id });

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

// Follow a user
router.post("/:id/follow", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const targetProfile = await Profile.findOne({ userID: req.params.id });
    const followerProfile = await Profile.findOne({ userID: req.user.id });

    if (!targetProfile || !followerProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId: req.user.id,
      followingId: req.params.id
    });

    if (existingFollow) {
      return res.status(400).json({ message: "Already following this user" });
    }

    // Create follow relationship
    const follow = new Follow({
      followerId: req.user.id,
      followingId: req.params.id
    });
    await follow.save();

    // Update follower counts
    await Profile.updateOne(
      { userID: req.params.id },
      { $inc: { "_count.followers": 1 } }
    );

    await Profile.updateOne(
      { userID: req.user.id },
      { $inc: { "_count.following": 1 } }
    );

    res.json({ message: "Successfully followed user" });
  } catch (error) {
    res.status(500).json({ message: "Error following user", error });
  }
});

// Unfollow a user
router.delete("/:id/follow", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const targetProfile = await Profile.findOne({ userID: req.params.id });
    const followerProfile = await Profile.findOne({ userID: req.user.id });

    if (!targetProfile || !followerProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Check if actually following
    const existingFollow = await Follow.findOne({
      followerId: req.user.id,
      followingId: req.params.id
    });

    if (!existingFollow) {
      return res.status(400).json({ message: "Not following this user" });
    }

    // Remove follow relationship
    await Follow.deleteOne({
      followerId: req.user.id,
      followingId: req.params.id
    });

    // Update follower counts
    await Profile.updateOne(
      { userID: req.params.id },
      { $inc: { "_count.followers": -1 } }
    );

    await Profile.updateOne(
      { userID: req.user.id },
      { $inc: { "_count.following": -1 } }
    );

    res.json({ message: "Successfully unfollowed user" });
  } catch (error) {
    res.status(500).json({ message: "Error unfollowing user", error });
  }
});

// Check following status
router.get("/:id/following-status", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const isFollowing = await Follow.exists({
      followerId: req.user.id,
      followingId: req.params.id
    });

    res.json({ isFollowing: !!isFollowing });
  } catch (error) {
    res.status(500).json({ message: "Error checking following status", error });
  }
});

// Get follow recommendations
router.get("/recommendations", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Get the IDs of users the current user is following
    const following = await Follow.find({ followerId: req.user.id })
      .select('followingId')
      .lean();
    const followingIds = following.map(f => f.followingId);

    // Get profiles the user is not following, excluding themselves
    const recommendations = await Profile.find({
      userID: { 
        $nin: [
          ...followingIds,
          req.user.id
        ] 
      }
    })
    .limit(5)
    .lean();

    // Populate username for each profile
    const populatedRecommendations = await Promise.all(
      recommendations.map(async (profile) => {
        const user = await User.findById(profile.userID).select('username');
        return {
          ...profile,
          username: user?.username || undefined,
          _id: profile.userID // Use userID as _id for consistency
        };
      })
    );

    res.json(populatedRecommendations);
  } catch (error) {
    res.status(500).json({ message: "Error fetching recommendations", error });
  }
});

router.post("/", createProfile);
router.get("/", getProfiles);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id", getProfileById);
router.patch("/:id", updateProfile);

export default router;

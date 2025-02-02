import express, { RequestHandler } from "express";
import Profile from "../models/Profile";
import Followers from "../models/Followers";
import axios from "axios";
import { z } from "zod"; // Import zod for schema validation
import User from "../models/User"; // <-- Added User model import

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

// Get a profile by ID
const getProfileById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await Profile.findOne({ userID: id });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    // Fetch additional data from another API
    let followersCount;
    let followingCount;

    const user = await User.findById(profile.userID);

    try {
      followersCount = await axios.get(`http://localhost:3000/api/profiles/${id}/followers`);
    } catch (error) {
      followersCount = { data: { _count: 0 } };
    }

    try {
      followingCount = await axios.get(`http://localhost:3000/api/profiles/${id}/following`);
    } catch (error) {
      followingCount = { data: { _count: 0 } };
    }

    // Combine profile data with additional data
    const combinedData = {
      ...profile.toObject(),
      username: user ? user.username : "",
      _count: {
        followers: followersCount.data._count,
        following: followingCount.data._count,
        posts: 0,
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
    const followers = await Followers.find({ userID: id });
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
    const following = await Followers.find({ contentID: id });
    const _count = await Followers.countDocuments({ contentID: id });
    res.json({ following, _count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching following", error });
  }
};

//Update a profile by ID
const updateProfile: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = profileSchema.partial().parse(req.body);
    const updatedProfile = await Profile.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updatedProfile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }
    res.json(updatedProfile);
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error });
  }
};

router.post("/", createProfile);
router.get("/", getProfiles);

router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);
router.get("/:id", getProfileById);
router.put("/:id", updateProfile);

export default router;

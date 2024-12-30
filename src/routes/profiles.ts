import express, { RequestHandler } from "express";
import Profile from "../models/Profile";

const router = express.Router();

// Create a new profile
const createProfile: RequestHandler = async (req, res) => {
  try {
    const profileData = req.body;
    const newProfile = new Profile(profileData);
    await newProfile.save();
    res.status(201).json({ message: "Profile created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error creating profile", error });
  }
};

// Get a profile by handle
const getProfileByHandle: RequestHandler = async (req, res) => {
  try {
    const { handle } = req.params;
    const profile = await Profile.findOne({ handle });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error });
  }
};

router.post("/", createProfile);
router.get("/:handle", getProfileByHandle);

export default router;

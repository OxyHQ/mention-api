import express, { RequestHandler } from "express";
import Profile, { IProfile } from "../models/Profile";
import { AuthRequest } from "../middleware/auth";
import { authMiddleware } from "../middleware/auth";

const router = express.Router();

// Get user's privacy settings
const getPrivacySettings: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const profile = await Profile.findOne({ userID: userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(profile.privacySettings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching privacy settings", error });
  }
};

// Update user's privacy settings
const updatePrivacySettings: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const updatedSettings = req.body;

    // Validate the privacy settings object structure
    const validSettings = [
      "isPrivateAccount",
      "hideOnlineStatus",
      "hideLastSeen",
      "profileVisibility",
      "postVisibility",
      "twoFactorEnabled",
      "loginAlerts",
      "blockScreenshots",
      "secureLogin",
      "biometricLogin",
      "showActivity",
      "allowTagging",
      "allowMentions",
      "hideReadReceipts",
      "allowComments",
      "allowDirectMessages",
      "dataSharing",
      "locationSharing",
      "analyticsSharing",
      "sensitiveContent",
      "autoFilter",
      "muteKeywords",
    ];

    // Filter out invalid settings
    const sanitizedSettings: Partial<IProfile["privacySettings"]> = Object.keys(
      updatedSettings
    ).reduce((acc, key) => {
      if (validSettings.includes(key)) {
        acc[key as keyof IProfile["privacySettings"]] = Boolean(
          updatedSettings[key]
        );
      }
      return acc;
    }, {} as Partial<IProfile["privacySettings"]>);

    // Update each setting individually using dot notation
    const updateQuery = Object.entries(sanitizedSettings).reduce((acc, [key, value]) => {
      acc[`privacySettings.${key}`] = value;
      return acc;
    }, {} as Record<string, boolean>);

    const profile = await Profile.findOneAndUpdate(
      { userID: userId },
      { $set: updateQuery },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile.privacySettings);
  } catch (error) {
    res.status(500).json({ message: "Error updating privacy settings", error });
  }
};

// Apply middleware to all routes
router.use(authMiddleware);

// Routes
router.get("/", getPrivacySettings);
router.put("/", updatePrivacySettings);

export default router;

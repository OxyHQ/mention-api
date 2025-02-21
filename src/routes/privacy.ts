import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import Profile from "../models/Profile";
import Block from "../models/Block";
import { authMiddleware } from '../middleware/auth';
import { z } from "zod";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

const router = express.Router();
router.use(authMiddleware);

const privacySettingsSchema = z.object({
  isPrivateAccount: z.boolean().optional(),
  hideOnlineStatus: z.boolean().optional(),
  hideLastSeen: z.boolean().optional(),
  profileVisibility: z.boolean().optional(),
  postVisibility: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  loginAlerts: z.boolean().optional(),
  blockScreenshots: z.boolean().optional(),
  secureLogin: z.boolean().optional(),
  biometricLogin: z.boolean().optional(),
  showActivity: z.boolean().optional(),
  allowTagging: z.boolean().optional(),
  allowMentions: z.boolean().optional(),
  hideReadReceipts: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  allowDirectMessages: z.boolean().optional(),
  dataSharing: z.boolean().optional(),
  locationSharing: z.boolean().optional(),
  analyticsSharing: z.boolean().optional(),
  sensitiveContent: z.boolean().optional(),
  autoFilter: z.boolean().optional(),
  muteKeywords: z.boolean().optional(),
});

// Get privacy settings
const getPrivacySettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await Profile.findOne({ userID: id }).select('privacySettings');
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(profile.privacySettings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching privacy settings", error });
  }
};

// Update privacy settings
const updatePrivacySettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settings = privacySettingsSchema.parse(req.body);
    const authUser = (req as AuthenticatedRequest).user;

    if (authUser?.id !== id) {
      return res.status(403).json({ message: "Not authorized to update these settings" });
    }

    const profile = await Profile.findOneAndUpdate(
      { userID: id },
      { $set: { privacySettings: settings } },
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

// Get blocked users
const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const blocks = await Block.find({ userId: authUser?.id })
      .populate('blockedId', 'username avatar')
      .lean();
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ message: "Error fetching blocked users", error });
  }
};

// Block a user
const blockUser = async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser?.id || authUser.id === targetId) {
      return res.status(400).json({ message: "Invalid block request" });
    }

    const existingBlock = await Block.findOne({
      userId: authUser.id,
      blockedId: targetId
    });

    if (existingBlock) {
      return res.status(409).json({ message: "User already blocked" });
    }

    const block = new Block({
      userId: authUser.id,
      blockedId: targetId
    });
    await block.save();

    res.json({ message: "User blocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error blocking user", error });
  }
};

// Unblock a user
const unblockUser = async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await Block.deleteOne({
      userId: authUser.id,
      blockedId: targetId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Block not found" });
    }

    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error unblocking user", error });
  }
};

router.get("/:id/privacy", getPrivacySettings);
router.patch("/:id/privacy", updatePrivacySettings);
router.get("/blocked", getBlockedUsers);
router.post("/blocked/:targetId", blockUser);
router.delete("/blocked/:targetId", unblockUser);

export default router;

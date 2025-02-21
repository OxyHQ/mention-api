import { Request, Response, NextFunction } from 'express';
import Profile from '../models/Profile';

export const checkPremiumAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userID } = req.query;
    if (!userID) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const profile = await Profile.findOne({ userID });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!profile.privacySettings?.analyticsSharing) {
      return res.status(403).json({ 
        message: "Analytics access denied", 
        error: "PREMIUM_REQUIRED",
        details: "Analytics features require a premium subscription"
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Error checking premium access", error });
  }
};
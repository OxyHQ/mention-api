import { Request, Response } from "express";
import Analytics from "../models/Analytics";
import Post from "../models/Post";
import Profile from "../models/Profile";
import { getDateRange } from "./utils/dateUtils";

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { userID, period = "weekly" } = req.query;
    const { startDate, endDate } = getDateRange(period as string);

    const analytics = await Analytics.find({
      userID,
      period,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Get aggregate post stats
    const postStats = await Post.aggregate([
      { $match: { userID, created_at: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: null,
        totalPosts: { $sum: 1 },
        totalLikes: { $sum: "$_count.likes" },
        totalReposts: { $sum: "$_count.reposts" },
        totalQuotes: { $sum: "$_count.quotes" },
        totalBookmarks: { $sum: "$_count.bookmarks" },
        totalReplies: { $sum: "$_count.replies" }
      }}
    ]);

    // Get growth metrics
    const profileStats = await Profile.findOne({ userID }, { _count: 1 });
    
    res.json({
      timeSeriesData: analytics,
      aggregate: postStats[0] || {},
      growth: profileStats?._count || {}
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching analytics", error });
  }
};

export const updateAnalytics = async (req: Request, res: Response) => {
  try {
    const { userID, type, data } = req.body;
    const date = new Date();
    
    // Update or create analytics record for each period
    const periods = ["daily", "weekly", "monthly", "yearly"];
    
    await Promise.all(periods.map(async (period) => {
      const update = {
        $inc: {
          [`stats.${type}`]: 1,
          ...data
        }
      };
      
      await Analytics.findOneAndUpdate(
        { userID, period, date },
        update,
        { upsert: true, new: true }
      );
    }));

    res.json({ message: "Analytics updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating analytics", error });
  }
};

export const getHashtagStats = async (req: Request, res: Response) => {
  try {
    const { hashtag } = req.params;
    const { period } = req.query;
    const { startDate, endDate } = getDateRange(period as string);

    const stats = await Post.aggregate([
      { 
        $match: { 
          text: { $regex: `#${hashtag}`, $options: 'i' },
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          totalLikes: { $sum: "$_count.likes" },
          totalReposts: { $sum: "$_count.reposts" },
          totalQuotes: { $sum: "$_count.quotes" },
          totalBookmarks: { $sum: "$_count.bookmarks" },
          totalReplies: { $sum: "$_count.replies" }
        }
      }
    ]);

    res.json(stats[0] || {
      totalPosts: 0,
      totalLikes: 0,
      totalReposts: 0,
      totalQuotes: 0,
      totalBookmarks: 0,
      totalReplies: 0
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching hashtag stats", error });
  }
};
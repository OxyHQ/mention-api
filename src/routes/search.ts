import express, { Request, Response } from "express";
import User from "../models/User";
import Post from "../models/Post";
import Profile from "../models/Profile";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { query, type = "all" } = req.query;
    const searchQuery = { $regex: query as string, $options: "i" };
    
    const results: any = { users: [], posts: [], profiles: [] };

    if (type === "all" || type === "users") {
      const profiles = await Profile.find({ 
      $or: [
        { description: searchQuery }
      ]
      })
      .limit(5);

      const userIds = profiles.map((profile: any) => profile.userID);
      const users = await User.find({ 
      $or: [
        { _id: { $in: userIds } },
        { username: searchQuery }
      ]
      })
      .select("username")
      .limit(5);

      results.users = users.map((user: any) => {
      const profile = profiles.find((profile: any) => profile.userID.toString() === user._id.toString());
      return {
        ...user.toObject(),
        description: profile?.description,
        avatar: profile?.avatar
      };
      });
    }

    if (type === "all" || type === "posts") {
      results.posts = await Post.find({ 
        $or: [
          { text: searchQuery },
          { hashtags: searchQuery }
        ]
      })
      .sort({ created_at: -1 })
      .limit(10);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Error performing search", error });
  }
});

export default router;
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
      results.users = await User.find({ username: searchQuery })
        .select("username email")
        .limit(5);
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

    if (type === "all" || type === "profiles") {
      results.profiles = await Profile.find({ 
        $or: [
          { displayName: searchQuery },
          { bio: searchQuery }
        ]
      })
      .limit(5);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Error performing search", error });
  }
});

export default router;
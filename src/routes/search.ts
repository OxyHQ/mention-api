import express, { Request, Response } from "express";
import User from "../models/User";
import Post from "../models/Post";
import { logger } from '../utils/logger';

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { query, type = "all" } = req.query;
    const searchQuery = { $regex: query as string, $options: "i" };
    
    const results: any = { users: [], posts: [] };

    if (type === "all" || type === "users") {
      const users = await User.find({ 
        $or: [
          { username: searchQuery },
          { description: searchQuery },
          { 'name.first': searchQuery },
          { 'name.last': searchQuery },
          { location: searchQuery }
        ]
      })
      .select('username name description avatar location')
      .limit(5);

      results.users = users.map(user => ({
        ...user.toObject(),
        name: user.name || { first: '', last: '' },
        description: user.description || '',
        avatar: user.avatar || ''
      }));
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
    logger.error('Search error:', error);
    res.status(500).json({ 
      message: "Error performing search", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export default router;
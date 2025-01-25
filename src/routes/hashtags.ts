import express, { Request, Response } from "express";
import Post from "../models/Post";

const router = express.Router();

// Get all hashtags
router.get("/", async (req: Request, res: Response) => {
  try {
    const posts = await Post.find({ text: { $exists: true, $ne: "" } });

    const hashtagCounts = posts.reduce((acc: Record<string, { count: number, createdAt: Date, text: string }>, post) => {
      const hashtags = (post.toObject().text as string).match(/#[a-zA-Z0-9_]+/g) || [];
      hashtags.forEach((hashtag) => {
        const tag = hashtag.toLowerCase();
        if (!acc[tag]) {
          acc[tag] = { count: 0, createdAt: post.createdAt as Date, text: hashtag.toLowerCase().substring(1) as string };
        }
        acc[tag].count += 1;
      });
      return acc;
    }, {});

    const hashtags = Object.entries(hashtagCounts)
      .map(([hashtag, data]) => ({ text: data.text, hashtag, count: data.count, createdAt: data.createdAt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ hashtags });
  } catch (error) {
    res.status(500).json({ message: "Error fetching hashtags from posts", error });
  }
});

export default router;

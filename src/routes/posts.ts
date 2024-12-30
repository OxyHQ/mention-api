import express, { Request, Response } from "express";
import Post from "../models/Post";
import User from "../models/User";

const router = express.Router();

// Create a new post
router.post("/", async (req: Request, res: Response) => {
  try {
    const { authorId, content } = req.body;
    const newPost = new Post({ author: authorId, content });
    await newPost.save();
    res.status(201).json({ message: "Create a new post" });
  } catch (error) {
    res.status(500).json({ message: "Error creating post", error });
  }
});

// Get all posts
router.get("/", async (req: Request, res: Response) => {
  try {
    const posts = await Post.find();

    const feed = posts.map((post) => ({
      post: {
        uri: post.uri,
        cid: post.cid,
        author: post.author,
        record: post.record,
        embed: post.embed,
        replyCount: post.replyCount,
        repostCount: post.repostCount,
        likeCount: post.likeCount,
        quoteCount: post.quoteCount,
        indexedAt: post.indexedAt,
        labels: post.labels,
      },
      feedContext: "",
    }));

    res.json({
      feed: feed,
      cursor: "",
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error });
  }
});

export default router;

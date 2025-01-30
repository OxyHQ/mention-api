import express, { Request, Response } from "express";
import Post from "../models/Post";
import User from "../models/User";
import Bookmark from "../models/Bookmark";

const router = express.Router();

// Create a new post
router.post("/", async (req: Request, res: Response) => {
  try {
    const { author_id, text, location, media } = req.body; // Added location to request body
    const newPost = new Post({
      author_id: author_id,
      text: text,
      created_at: new Date(),
      location: {
        type: "Point",
        coordinates: [location?.longitude, location?.latitude], // Added geolocation data
      },
      media: media,
    });
    await newPost.save();
    res.status(201).json({
      message: "Create a new post",
      post: {
        id: newPost._id,
        ...newPost.toObject(),
        _count: {
          likes: 0,
          quotes: 0,
          reposts: 0,
          bookmarks: 0,
          replies: 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating post", error });
  }
});

// Get all posts
router.get("/", async (req: Request, res: Response) => {
  try {
    const { authorId, text, location } = req.body; // Added query parameters for filtering

    const filter: any = {};
    if (authorId) filter.authorId = authorId;
    if (text) filter.text = { $regex: text, $options: "i" };
    if (location) {
      const [longitude, latitude] = (location as string).split(",");
      filter.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: 10000, // 10 km radius
        },
      };
    }

    const posts = await Post.find(filter);

    const feed = posts.map((post) => ({
      id: post._id,
      ...post.toObject(),
        _count: {
          likes: 0,
          quotes: 0,
          reposts: 0,
          bookmarks: 0,
          replies: 0,
        },
      }));

    res.json({
      posts: feed,
      cursor: "",
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error });
  }
});

// Get posts by hashtag
router.get("/hashtag/:hashtag", async (req: Request, res: Response) => {
  try {
    const { hashtag } = req.params;
    const posts = await Post.find({ text: { $regex: `#${hashtag}`, $options: "i" } });

    const feed = posts.map((post) => ({
      id: post._id,
      ...post.toObject(),
      _count: {
        likes: 0,
        quotes: 0,
        reposts: 0,
        bookmarks: 0,
        replies: 0,
      },
    }));

    // Fetch related posts
    const relatedPosts = await Post.find({ text: { $regex: `#${hashtag}`, $options: "i" } }).limit(5);

    // Calculate stats
    const _count = {
      totalPosts: posts.length,
      likes: posts.reduce((acc, post) => acc + (typeof post.likes === 'number' ? post.likes : 0), 0),
      quotes: posts.reduce((acc, post) => acc + (typeof post.quotes === 'number' ? post.quotes : 0), 0),
      reposts: posts.reduce((acc, post) => acc + (typeof post.reposts === 'number' ? post.reposts : 0), 0),
      bookmarks: posts.reduce((acc, post) => acc + (typeof post.bookmarks === 'number' ? post.bookmarks : 0), 0),
      replies: posts.reduce((acc, post) => acc + (typeof post.replies === 'number' ? post.replies : 0), 0),
    };

    res.json({
      posts: feed,
      relatedPosts,
      _count,
      cursor: "",
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts by hashtag", error });
  }
});

// Bookmark a post
router.post("/:id/bookmark", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.body.userId;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingBookmark = await Bookmark.findOne({ userId, postId });
    if (!existingBookmark) {
      const newBookmark = new Bookmark({ userId, postId });
      await newBookmark.save();
    }

    res.status(200).json({ message: "Post bookmarked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error bookmarking post", error });
  }
});

// Remove bookmark from a post
router.delete("/:id/bookmark", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.body.userId;

    const bookmark = await Bookmark.findOneAndDelete({ userId, postId });
    if (!bookmark) {
      return res.status(404).json({ message: "Bookmark not found" });
    }

    res.status(200).json({ message: "Bookmark removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error removing bookmark", error });
  }
});

// Retrieve bookmarked posts for a user
router.get("/bookmarks", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" + userId });
    }

    const bookmarks = await Bookmark.find({ userId })
      .populate({
        path: "postId",
        model: "Post"
      })
      .sort({ createdAt: -1 }); // Order by date bookmarked

    const bookmarkedPosts = bookmarks.map((bookmark) => {
      const post = bookmark.postId as any;
      return {
        id: post._id,
        ...post.toObject(),
        _count: {
          likes: 0,
          quotes: 0,
          reposts: 0,
          bookmarks: 0,
          replies: 0,
        },
      };
    });

    res.json({ posts: bookmarkedPosts });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving bookmarked posts", error });
  }
});

export default router;

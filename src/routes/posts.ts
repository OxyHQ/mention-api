import express, { Request, Response } from "express";
import Post from "../models/Post";
import User from "../models/User";
import Bookmark from "../models/Bookmark";
import Like from "../models/Like";
import { authMiddleware } from '../middleware/auth';
import { io } from '../server';

const router = express.Router();

// Public routes first
router.get('/explore', /* ... */);

// Then protect all other routes
router.use(authMiddleware);

// Create a new post
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userID, text, location, media } = req.body; // Added location to request body
    const newPost = new Post({
      userID: userID,
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
      message: "Post created successfully",
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
    const { userID, text, location } = req.body;

    const filter: any = {};
    if (userID) filter.userID = userID;
    if (text) filter.text = { $regex: text, $options: "i" };
    if (location) {
      const [longitude, latitude] = (location as string).split(",");
      filter.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: 10000,
        },
      };
    }

    const posts = await Post.find(filter);
    const postsWithCounts = await Promise.all(posts.map(async (post) => {
      const likesCount = await Like.countDocuments({ postId: post._id });
      const bookmarksCount = await Bookmark.countDocuments({ postId: post._id });

      return {
        id: post._id,
        ...post.toObject(),
        _count: {
          likes: likesCount,
          quotes: 0,
          reposts: 0,
          bookmarks: bookmarksCount,
          replies: 0,
        },
      };
    }));

    res.json({
      posts: postsWithCounts,
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
      return res.status(404).json({ message: "User not found " + userId });
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

// Like a post
router.post("/:id/like", async (req: Request, res: Response) => {
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

    const existingLike = await Like.findOne({ userId, postId });
    if (!existingLike) {
      const newLike = new Like({ userId, postId });
      await newLike.save();
      
      const likesCount = await Like.countDocuments({ postId });
      
      await Post.findByIdAndUpdate(postId, { 
        $set: { '_count.likes': likesCount }
      });

      // Emit socket event
      io.to(`post:${postId}`).emit('postLiked', {
        postId: postId.toString(),
        userId: userId.toString(),
        likesCount,
        isLiked: true,
        _count: {
          ...(post._count || {}),
          likes: likesCount
        }
      });

      res.status(200).json({ 
        message: "Post liked successfully",
        postId: postId.toString(),
        likesCount,
        isLiked: true
      });
    } else {
      const likesCount = await Like.countDocuments({ postId });
      res.status(200).json({ 
        message: "Post already liked",
        postId: postId.toString(),
        likesCount,
        isLiked: true
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error liking post", error });
  }
});

// Unlike a post
router.delete("/:id/like", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.body.userId;

    const like = await Like.findOneAndDelete({ userId, postId });
    if (!like) {
      return res.status(404).json({ message: "Like not found" });
    }

    const likesCount = await Like.countDocuments({ postId });
    const post = await Post.findByIdAndUpdate(postId, { 
      $set: { '_count.likes': likesCount }
    }, { new: true });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Emit socket event
    io.to(`post:${postId}`).emit('postUnliked', {
      postId: postId.toString(),
      userId: userId.toString(),
      likesCount,
      isLiked: false,
      _count: {
        ...(post._count || {}),
        likes: likesCount
      }
    });

    res.status(200).json({ 
      message: "Like removed successfully",
      postId: postId.toString(),
      likesCount,
      isLiked: false
    });
  } catch (error) {
    res.status(500).json({ message: "Error removing like", error });
  }
});

// Check if a post is liked by user
router.get("/:id/like", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ message: "userId query parameter is required" });
    }

    const like = await Like.findOne({ userId, postId });
    res.status(200).json({ isLiked: !!like });
  } catch (error) {
    res.status(500).json({ message: "Error checking like status", error });
  }
});

export default router;

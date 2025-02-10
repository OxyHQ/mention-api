import express, { Request, Response } from "express";
import Post from "../models/Post";
import User from "../models/User";
import Bookmark from "../models/Bookmark";
import Like from "../models/Like";
import Notification from "../models/Notification";
import { authMiddleware } from '../middleware/auth';
import { io } from '../server';
import mongoose from "mongoose";

// Define interfaces for our models
interface IPost extends mongoose.Document {
  userID: mongoose.Types.ObjectId;
  text: string;
  created_at: Date;
  location?: {
    type: string;
    coordinates: number[];
  };
  media?: any;
  in_reply_to_status_id?: string;
  _count?: PostCount;
}

// Define the PostCount type to match the schema
interface PostCount {
  likes: number;
  quotes: number;
  reposts: number;
  bookmarks: number;
  replies: number;
}

const router = express.Router();

// Public routes first
router.get('/explore', /* ... */);

// Then protect all other routes
router.use(authMiddleware);

// Create a new post
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userID, text, location, media, in_reply_to_status_id } = req.body;
    const newPost = new Post({
      userID,
      text,
      created_at: new Date(),
      location: location ? {
        type: "Point",
        coordinates: [location?.longitude, location?.latitude],
      } : undefined,
      media,
      in_reply_to_status_id,
    });

    await newPost.save();

    // If this is a reply, create notification and increment reply count
    if (in_reply_to_status_id) {
      const parentPost = await Post.findById(in_reply_to_status_id) as IPost;
      if (parentPost && parentPost.userID.toString() !== userID) {
        await new Notification({
          recipientId: parentPost.userID,
          actorId: userID,
          type: 'reply',
          entityId: newPost._id,
          entityType: 'post'
        }).save();
      }
      await Post.findByIdAndUpdate(in_reply_to_status_id, {
        $inc: { '_count.replies': 1 }
      });
    }

    // Check for mentions and create notifications
    const mentions = text.match(/@(\w+)/g);
    if (mentions) {
      const uniqueMentions = [...new Set(mentions.map((m: string) => m.substring(1)))];
      const mentionedUsers = await User.find({ username: { $in: uniqueMentions } });
      
      await Promise.all(mentionedUsers.map(async user => {
        if (user._id.toString() !== userID) {
          await new Notification({
            recipientId: user._id,
            actorId: userID,
            type: 'mention',
            entityId: newPost._id,
            entityType: 'post'
          }).save();
        }
      }));
    }

    // Emit socket event for the new post
    io.emit('newPost', {
      id: newPost._id,
      ...newPost.toObject(),
      _count: {
        likes: 0,
        quotes: 0,
        reposts: 0,
        bookmarks: 0,
        replies: 0,
      },
    });

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
    const { userID, text, location } = req.query;

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

    const posts = await Post.find(filter).sort({ created_at: -1 });

    const postsWithCounts = posts.map(post => {
      const counts: PostCount = {
        likes: 0,
        quotes: 0,
        reposts: 0,
        bookmarks: 0,
        replies: (post._count as any)?.replies || 0
      };

      return {
        id: post._id,
        ...post.toObject(),
        _count: counts
      };
    });

    res.json({
      message: "Posts retrieved successfully",
      posts: postsWithCounts,
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
        model: "Post",
        populate: {
          path: "userID",
          model: "User",
          select: "username name avatar"
        }
      })
      .sort({ createdAt: -1 });

    const bookmarkedPosts = await Promise.all(bookmarks.map(async (bookmark) => {
      const post = bookmark.postId as any;
      if (!post) return null;

      const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
        Like.countDocuments({ postId: post._id }),
        Post.countDocuments({ quoted_status_id: post._id }),
        Post.countDocuments({ repost_of: post._id }),
        Bookmark.countDocuments({ postId: post._id }),
        Post.countDocuments({ in_reply_to_status_id: post._id })
      ]);

      const isLiked = await Like.exists({ userId, postId: post._id });
      const isBookmarked = true; // Since this is in bookmarks, it must be bookmarked

      return {
        id: post._id,
        ...post.toObject(),
        isLiked: !!isLiked,
        isBookmarked,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      };
    }));

    const filteredPosts = bookmarkedPosts.filter(post => post !== null);
    res.json({ posts: filteredPosts });
  } catch (error) {
    console.error("Error retrieving bookmarked posts:", error);
    res.status(500).json({ message: "Error retrieving bookmarked posts", error });
  }
});

// Like a post
router.post("/:id/like", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.body.userId;

    const post = await Post.findById(postId) as IPost;
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
      
      // Create notification for post like
      if (post.userID.toString() !== userId) {
        await new Notification({
          recipientId: post.userID,
          actorId: userId,
          type: 'like',
          entityId: postId,
          entityType: 'post'
        }).save();
      }

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

    if (!postId || !userId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const like = await Like.findOne({ userId, postId });
    res.json({ isLiked: !!like });
  } catch (error) {
    res.status(500).json({ message: "Error checking like status", error });
  }
});

export default router;

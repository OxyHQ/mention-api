import express, { Request as ExpressRequest, Response } from "express";
import { Socket, Namespace } from "socket.io";
import Post from "../models/Post";
import User from "../models/User";
import Bookmark from "../models/Bookmark";
import Like from "../models/Like";
import Notification from "../models/Notification";
import { authMiddleware } from '../middleware/auth';
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

// Add interface to include user property
interface Request extends ExpressRequest {
  user?: {
    _id: mongoose.Types.ObjectId;
  };
}

// Custom socket interface to include user property
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    [key: string]: any;
  };
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

    // Get the posts namespace
    const postsNamespace = req.app.get('postsNamespace');

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

    // Emit using the posts namespace
    postsNamespace.emit('newPost', {
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
    const currentUserId = req.user?._id; // Get the authenticated user's ID
    const postsNamespace = req.app.get('postsNamespace');

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

    const postsWithCounts = await Promise.all(posts.map(async post => {
      // Make sure the socket joins the room for this post
      const postRoomId = `post:${post._id}`;
      postsNamespace.socketsJoin(postRoomId);

      const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount, isLiked, isBookmarked] = await Promise.all([
        Like.countDocuments({ postId: post._id }),
        Post.countDocuments({ quoted_status_id: post._id }),
        Post.countDocuments({ repost_of: post._id }),
        Bookmark.countDocuments({ postId: post._id }),
        Post.countDocuments({ in_reply_to_status_id: post._id }),
        currentUserId ? Like.exists({ userId: currentUserId, postId: post._id }) : false,
        currentUserId ? Bookmark.exists({ userId: currentUserId, postId: post._id }) : false
      ]);

      return {
        id: post._id,
        ...post.toObject(),
        isLiked: !!isLiked,
        isBookmarked: !!isBookmarked,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      };
    }));

    res.json({
      message: "Posts retrieved successfully",
      posts: postsWithCounts,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error });
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

// Get a single post by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
      Like.countDocuments({ postId: post._id }),
      Post.countDocuments({ quoted_status_id: post._id }),
      Post.countDocuments({ repost_of: post._id }),
      Bookmark.countDocuments({ postId: post._id }),
      Post.countDocuments({ in_reply_to_status_id: post._id })
    ]);

    const postWithCounts = {
      id: post._id,
      ...post.toObject(),
      _count: {
        likes: likesCount,
        quotes: quotesCount,
        reposts: repostsCount,
        bookmarks: bookmarksCount,
        replies: repliesCount
      }
    };

    res.json({ 
      message: "Post retrieved successfully",
      posts: [postWithCounts]  // Keeping consistent with other endpoints that return posts array
    });
  } catch (error) {
    console.error("Error retrieving post:", error);
    res.status(500).json({ message: "Error retrieving post", error });
  }
});

// Get posts by hashtag
router.get("/hashtag/:hashtag", async (req: Request, res: Response) => {
  try {
    const { hashtag } = req.params;
    const currentUserId = req.user?._id;
    const postsNamespace = req.app.get('postsNamespace');
    
    const posts = await Post.find({ text: { $regex: `#${hashtag}`, $options: "i" } });

    const feed = await Promise.all(posts.map(async post => {
      // Join socket room for this post
      const postRoomId = `post:${post._id}`;
      postsNamespace.socketsJoin(postRoomId);

      const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount, isLiked, isBookmarked] = await Promise.all([
        Like.countDocuments({ postId: post._id }),
        Post.countDocuments({ quoted_status_id: post._id }),
        Post.countDocuments({ repost_of: post._id }),
        Bookmark.countDocuments({ postId: post._id }),
        Post.countDocuments({ in_reply_to_status_id: post._id }),
        currentUserId ? Like.exists({ userId: currentUserId, postId: post._id }) : false,
        currentUserId ? Bookmark.exists({ userId: currentUserId, postId: post._id }) : false
      ]);

      return {
        id: post._id,
        ...post.toObject(),
        isLiked: !!isLiked,
        isBookmarked: !!isBookmarked,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      };
    }));

    // Fetch related posts with the same treatment
    const relatedPosts = await Promise.all((await Post.find({ text: { $regex: `#${hashtag}`, $options: "i" } }).limit(5)).map(async post => {
      const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount, isLiked, isBookmarked] = await Promise.all([
        Like.countDocuments({ postId: post._id }),
        Post.countDocuments({ quoted_status_id: post._id }),
        Post.countDocuments({ repost_of: post._id }),
        Bookmark.countDocuments({ postId: post._id }),
        Post.countDocuments({ in_reply_to_status_id: post._id }),
        currentUserId ? Like.exists({ userId: currentUserId, postId: post._id }) : false,
        currentUserId ? Bookmark.exists({ userId: currentUserId, postId: post._id }) : false
      ]);

      return {
        id: post._id,
        ...post.toObject(),
        isLiked: !!isLiked,
        isBookmarked: !!isBookmarked,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      };
    }));

    // Calculate aggregated stats from actual counts
    const _count = {
      totalPosts: posts.length,
      likes: feed.reduce((acc, post) => acc + (post._count?.likes || 0), 0),
      quotes: feed.reduce((acc, post) => acc + (post._count?.quotes || 0), 0),
      reposts: feed.reduce((acc, post) => acc + (post._count?.reposts || 0), 0),
      bookmarks: feed.reduce((acc, post) => acc + (post._count?.bookmarks || 0), 0),
      replies: feed.reduce((acc, post) => acc + (post._count?.replies || 0), 0),
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

    const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
      Like.countDocuments({ postId }),
      Post.countDocuments({ quoted_status_id: postId }),
      Post.countDocuments({ repost_of: postId }),
      Bookmark.countDocuments({ postId }),
      Post.countDocuments({ in_reply_to_status_id: postId })
    ]);

    // Get posts namespace
    const postsNamespace = req.app.get('postsNamespace');

    // Emit to the specific post's room
    postsNamespace.to(`post:${postId}`).emit('postBookmarked', {
      postId: postId.toString(),
      userId: userId.toString(),
      bookmarksCount,
      isBookmarked: true,
      _count: {
        likes: likesCount,
        quotes: quotesCount,
        reposts: repostsCount,
        bookmarks: bookmarksCount,
        replies: repliesCount
      }
    });

    res.status(200).json({ 
      message: "Post bookmarked successfully",
      postId: postId.toString(),
      bookmarksCount,
      isBookmarked: true,
      _count: {
        likes: likesCount,
        quotes: quotesCount,
        reposts: repostsCount,
        bookmarks: bookmarksCount,
        replies: repliesCount
      }
    });
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

    const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
      Like.countDocuments({ postId }),
      Post.countDocuments({ quoted_status_id: postId }),
      Post.countDocuments({ repost_of: postId }),
      Bookmark.countDocuments({ postId }),
      Post.countDocuments({ in_reply_to_status_id: postId })
    ]);

    res.status(200).json({ 
      message: "Bookmark removed successfully",
      postId: postId.toString(),
      bookmarksCount,
      isBookmarked: false,
      _count: {
        likes: likesCount,
        quotes: quotesCount,
        reposts: repostsCount,
        bookmarks: bookmarksCount,
        replies: repliesCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error removing bookmark", error });
  }
});

// Like a post
router.post("/:id/like", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.body.userId;
    const postsNamespace = req.app.get('postsNamespace');

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

      const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
        Like.countDocuments({ postId }),
        Post.countDocuments({ quoted_status_id: postId }),
        Post.countDocuments({ repost_of: postId }),
        Bookmark.countDocuments({ postId }),
        Post.countDocuments({ in_reply_to_status_id: postId })
      ]);

      const updatedPost = await Post.findByIdAndUpdate(postId, { 
        $set: { 
          '_count': {
            likes: likesCount,
            quotes: quotesCount,
            reposts: repostsCount,
            bookmarks: bookmarksCount,
            replies: repliesCount
          }
        }
      }, { new: true });

      // Emit to the specific post's room
      postsNamespace.to(`post:${postId}`).emit('postLiked', {
        postId: postId.toString(),
        userId: userId.toString(),
        likesCount,
        isLiked: true,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      });

      res.status(200).json({ 
        message: "Post liked successfully",
        postId: postId.toString(),
        likesCount,
        isLiked: true,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      });
    } else {
      const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
        Like.countDocuments({ postId }),
        Post.countDocuments({ quoted_status_id: postId }),
        Post.countDocuments({ repost_of: postId }),
        Bookmark.countDocuments({ postId }),
        Post.countDocuments({ in_reply_to_status_id: postId })
      ]);

      res.status(200).json({ 
        message: "Post already liked",
        postId: postId.toString(),
        likesCount,
        isLiked: true,
        _count: {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
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
    const postsNamespace = req.app.get('postsNamespace');

    const like = await Like.findOneAndDelete({ userId, postId });
    if (!like) {
      return res.status(404).json({ message: "Like not found" });
    }

    const [likesCount, quotesCount, repostsCount, bookmarksCount, repliesCount] = await Promise.all([
      Like.countDocuments({ postId }),
      Post.countDocuments({ quoted_status_id: postId }),
      Post.countDocuments({ repost_of: postId }),
      Bookmark.countDocuments({ postId }),
      Post.countDocuments({ in_reply_to_status_id: postId })
    ]);

    const post = await Post.findByIdAndUpdate(postId, { 
      $set: { 
        '_count': {
          likes: likesCount,
          quotes: quotesCount,
          reposts: repostsCount,
          bookmarks: bookmarksCount,
          replies: repliesCount
        }
      }
    }, { new: true });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Emit to the specific post's room
    postsNamespace.to(`post:${postId}`).emit('postUnliked', {
      postId: postId.toString(),
      userId: userId.toString(),
      likesCount,
      isLiked: false,
      _count: {
        likes: likesCount,
        quotes: quotesCount,
        reposts: repostsCount,
        bookmarks: bookmarksCount,
        replies: repliesCount
      }
    });

    res.status(200).json({ 
      message: "Like removed successfully",
      postId: postId.toString(),
      likesCount,
      isLiked: false,
      _count: {
        likes: likesCount,
        quotes: quotesCount,
        reposts: repostsCount,
        bookmarks: bookmarksCount,
        replies: repliesCount
      }
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

// Check if a post is bookmarked by user
router.get("/:id/bookmark", async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.query.userId as string;

    if (!postId || !userId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const bookmark = await Bookmark.findOne({ userId, postId });
    res.json({ isBookmarked: !!bookmark });
  } catch (error) {
    res.status(500).json({ message: "Error checking bookmark status", error });
  }
});

export default router;

import { Request, Response, NextFunction } from "express";
import Post, { IPost } from "../models/Post";
import { logger } from '../utils/logger';
import mongoose, { Types } from 'mongoose';
import { AuthRequest } from '../types/auth';
import createError from 'http-errors';
import Bookmark from "../models/Bookmark";

export class FeedController {
  /**
   * Get the home feed for the authenticated user
   * Shows posts from users they follow
   */
  async getHomeFeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(createError(401, 'Authentication required'));
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const cursor = req.query.cursor as string;

      // Build query
      const query: any = {
        userID: userId, // Field name is userID not user
        isDraft: { $ne: true },
        scheduledFor: { $exists: false }
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      // Get posts from followed users and the user's own posts
      const posts = await Post.find(query)
        .sort({ created_at: -1 })
        .limit(limit + 1); // Get one extra to determine if there are more

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1]._id : null;

      // Transform posts to match frontend expectations
      const transformedPosts = resultPosts.map(post => {
        const postObj = post.toObject() as any;
        return {
          ...postObj,
          id: postObj._id.toString(),
          author: {
            id: postObj.userID.toString(),
            username: "user", // Default values since we don't have user data
            name: "User",
            avatar: ""
          }
        };
      });

      return res.status(200).json({
        data: {
          posts: transformedPosts,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          hasMore
        }
      });
    } catch (error) {
      logger.error('Error in getHomeFeed:', error);
      return next(createError(500, 'Error retrieving home feed'));
    }
  }

  /**
   * Get the explore feed (trending/popular posts)
   * Available to all users, even unauthenticated ones
   */
  async getExploreFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const cursor = req.query.cursor as string;

      // Build query
      const query: any = {
        isDraft: { $ne: true },
        scheduledFor: { $exists: false }
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      // Get popular posts based on engagement metrics
      const posts = await Post.find(query)
        .sort({ created_at: -1 }) // Sort by creation date for now
        .limit(limit + 1); // Get one extra to determine if there are more

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1]._id : null;

      // Transform posts to match frontend expectations
      const transformedPosts = resultPosts.map(post => {
        const postObj = post.toObject() as any;
        return {
          ...postObj,
          id: postObj._id.toString(),
          author: {
            id: postObj.userID.toString(),
            username: "user", // Default values since we don't have user data
            name: "User",
            avatar: ""
          }
        };
      });

      return res.status(200).json({
        data: {
          posts: transformedPosts,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          hasMore
        }
      });
    } catch (error) {
      logger.error('Error in getExploreFeed:', error);
      return next(createError(500, 'Error retrieving explore feed'));
    }
  }

  /**
   * Get posts for a specific hashtag
   */
  async getHashtagFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const { hashtag } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const cursor = req.query.cursor as string;
      
      if (!hashtag) {
        return next(createError(400, 'Hashtag parameter is required'));
      }

      // Build query
      const query: any = {
        hashtags: { $regex: new RegExp(hashtag, 'i') },
        isDraft: { $ne: true },
        scheduledFor: { $exists: false }
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      // Find posts with the specified hashtag
      const posts = await Post.find(query)
        .sort({ created_at: -1 })
        .limit(limit + 1); // Get one extra to determine if there are more

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1]._id : null;

      // Transform posts to match frontend expectations
      const transformedPosts = resultPosts.map(post => {
        const postObj = post.toObject() as any;
        return {
          ...postObj,
          id: postObj._id.toString(),
          author: {
            id: postObj.userID.toString(),
            username: "user", // Default values since we don't have user data
            name: "User",
            avatar: ""
          }
        };
      });

      return res.status(200).json({
        data: {
          posts: transformedPosts,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          hasMore
        }
      });
    } catch (error) {
      logger.error('Error in getHashtagFeed:', error);
      return next(createError(500, 'Error retrieving hashtag feed'));
    }
  }

  /**
   * Get a specific post by ID
   */
  async getPostById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return next(createError(400, 'Post ID is required'));
      }

      const post = await Post.findById(id);

      if (!post) {
        return next(createError(404, 'Post not found'));
      }

      // Transform post to match frontend expectations
      const postObj = post.toObject() as any;
      const transformedPost = {
        ...postObj,
        id: postObj._id.toString(),
        author: {
          id: postObj.userID.toString(),
          username: "user", // Default values since we don't have user data
          name: "User",
          avatar: ""
        }
      };

      return res.status(200).json({
        data: transformedPost
      });
    } catch (error) {
      logger.error('Error in getPostById:', error);
      return next(createError(500, 'Error retrieving post'));
    }
  }

  /**
   * Get posts from a specific user
   */
  async getUserFeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const cursor = req.query.cursor as string;
      
      if (!userId) {
        return next(createError(400, 'User ID is required'));
      }

      // Build query
      const query: any = {
        userID: userId, // Field name is userID not user
        isDraft: { $ne: true },
        scheduledFor: { $exists: false }
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      // Get posts from the specified user
      const posts = await Post.find(query)
        .sort({ created_at: -1 })
        .limit(limit + 1); // Get one extra to determine if there are more

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1]._id : null;

      // Transform posts to match frontend expectations
      const transformedPosts = resultPosts.map(post => {
        const postObj = post.toObject() as any;
        return {
          ...postObj,
          id: postObj._id.toString(),
          author: {
            id: postObj.userID.toString(),
            username: "user", // Default values since we don't have user data
            name: "User",
            avatar: ""
          }
        };
      });

      return res.status(200).json({
        data: {
          posts: transformedPosts,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          hasMore
        }
      });
    } catch (error) {
      logger.error('Error in getUserFeed:', error);
      return next(createError(500, 'Error retrieving user feed'));
    }
  }

  /**
   * Get bookmarked posts for the authenticated user
   */
  async getBookmarksFeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const cursor = req.query.cursor as string;
      
      if (!userId) {
        return next(createError(401, 'Authentication required'));
      }

      // Find all bookmarks for the user
      const bookmarks = await Bookmark.find({ userId: userId })
        .sort({ createdAt: -1 });
      
      // Get the post IDs from bookmarks
      const postIds = bookmarks.map(bookmark => bookmark.postId);
      
      // Build query
      const query: any = {
        _id: { $in: postIds }
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        query._id = { ...query._id, $lt: new mongoose.Types.ObjectId(cursor) };
      }

      // Fetch the actual posts
      const posts = await Post.find(query)
        .sort({ created_at: -1 })
        .limit(limit + 1); // Get one extra to determine if there are more

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1]._id : null;

      // Transform posts to match frontend expectations
      const transformedPosts = resultPosts.map(post => {
        const postObj = post.toObject() as any;
        return {
          ...postObj,
          id: postObj._id.toString(),
          author: {
            id: postObj.userID.toString(),
            username: "user", // Default values since we don't have user data
            name: "User",
            avatar: ""
          }
        };
      });

      return res.status(200).json({
        data: {
          posts: transformedPosts,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          hasMore
        }
      });
    } catch (error) {
      logger.error('Error in getBookmarksFeed:', error);
      return next(createError(500, 'Error retrieving bookmarks feed'));
    }
  }

  /**
   * Get replies to a specific post
   */
  async getRepliesFeed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { parentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const cursor = req.query.cursor as string;
      
      if (!parentId) {
        return next(createError(400, 'Parent post ID is required'));
      }

      // Check if the parent post exists
      const parentPost = await Post.findById(parentId);
      if (!parentPost) {
        return next(createError(404, 'Parent post not found'));
      }

      // Build query
      const query: any = {
        in_reply_to_status_id: parentId,
        isDraft: { $ne: true },
        scheduledFor: { $exists: false }
      };

      // Add cursor-based pagination if cursor is provided
      if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      }

      // Get replies to the parent post
      const posts = await Post.find(query)
        .sort({ created_at: -1 })
        .limit(limit + 1); // Get one extra to determine if there are more

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1]._id : null;

      // Transform posts to match frontend expectations
      const transformedPosts = resultPosts.map(post => {
        const postObj = post.toObject() as any;
        return {
          ...postObj,
          id: postObj._id.toString(),
          author: {
            id: postObj.userID.toString(),
            username: "user", // Default values since we don't have user data
            name: "User",
            avatar: ""
          }
        };
      });

      return res.status(200).json({
        data: {
          posts: transformedPosts,
          nextCursor: nextCursor ? nextCursor.toString() : null,
          hasMore
        }
      });
    } catch (error) {
      logger.error('Error in getRepliesFeed:', error);
      return next(createError(500, 'Error retrieving replies feed'));
    }
  }
}

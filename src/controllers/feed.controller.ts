import { Request, Response, NextFunction } from 'express';
import Post from '../models/Post';
import User from '../models/User';
import Hashtag from '../models/Hashtag';
import { AuthRequest } from '../types/auth';
import { createError } from '../utils/error';
import mongoose from 'mongoose';

interface PostUser {
    _id: string;
    username: string;
    name: {
        first: string;
        last: string;
    };
    avatar: string;
    email: string;
    description: string;
}

interface TransformedPost {
    id: string;
    _id: string;
    text: string;
    author: PostUser;
    mentions?: PostUser[];
    quoted_post?: {
        id: string;
        _id: string;
        text: string;
        author: PostUser;
    } | null;
    repost_of?: {
        id: string;
        _id: string;
        text: string;
        author: PostUser;
    } | null;
    created_at: string;
    updated_at: string;
    _count: {
        likes: number;
        reposts: number;
        replies: number;
        bookmarks: number;
    };
    isLiked: boolean;
    isReposted: boolean;
    isBookmarked: boolean;
}

export class FeedController {
    private transformPost(post: any): TransformedPost {
        const postObj = post.toObject();
        
        // Ensure _id is converted to string
        const _id = postObj._id.toString();
        
        // Transform the author data
        const author: PostUser = {
            _id: postObj.userID._id.toString(),
            username: postObj.userID.username || '',
            name: {
                first: postObj.userID.name?.first || '',
                last: postObj.userID.name?.last || ''
            },
            avatar: postObj.userID.avatar || '',
            email: postObj.userID.email || '',
            description: postObj.userID.description || ''
        };

        // Transform mentions if they exist
        const mentions = postObj.mentions?.map((mention: any) => ({
            _id: mention._id.toString(),
            username: mention.username || '',
            name: {
                first: mention.name?.first || '',
                last: mention.name?.last || ''
            },
            avatar: mention.avatar || '',
            email: mention.email || '',
            description: mention.description || ''
        }));

        // Initialize the transformed post
        const transformed: TransformedPost = {
            id: _id,
            _id: _id,
            text: postObj.text || '',
            author,
            mentions,
            created_at: postObj.created_at || new Date().toISOString(),
            updated_at: postObj.updated_at || new Date().toISOString(),
            _count: {
                likes: postObj.likes?.length || 0,
                reposts: postObj.reposts?.length || 0,
                replies: postObj.replies?.length || 0,
                bookmarks: postObj.bookmarks?.length || 0
            },
            isLiked: postObj.likes?.some((like: any) => like._id.toString() === postObj.userID._id.toString()) || false,
            isReposted: postObj.reposts?.some((repost: any) => repost._id.toString() === postObj.userID._id.toString()) || false,
            isBookmarked: postObj.bookmarks?.some((bookmark: any) => bookmark._id.toString() === postObj.userID._id.toString()) || false
        };
        
        // Handle quoted post if it exists
        if (postObj.quoted_post_id) {
            transformed.quoted_post = {
                id: postObj.quoted_post_id._id.toString(),
                _id: postObj.quoted_post_id._id.toString(),
                text: postObj.quoted_post_id.text || '',
                author: {
                    _id: postObj.quoted_post_id.userID._id.toString(),
                    username: postObj.quoted_post_id.userID.username || '',
                    name: {
                        first: postObj.quoted_post_id.userID.name?.first || '',
                        last: postObj.quoted_post_id.userID.name?.last || ''
                    },
                    avatar: postObj.quoted_post_id.userID.avatar || '',
                    email: postObj.quoted_post_id.userID.email || '',
                    description: postObj.quoted_post_id.userID.description || ''
                }
            };
        } else {
            transformed.quoted_post = null;
        }

        // Handle repost if it exists
        if (postObj.repost_of) {
            transformed.repost_of = {
                id: postObj.repost_of._id.toString(),
                _id: postObj.repost_of._id.toString(),
                text: postObj.repost_of.text || '',
                author: {
                    _id: postObj.repost_of.userID._id.toString(),
                    username: postObj.repost_of.userID.username || '',
                    name: {
                        first: postObj.repost_of.userID.name?.first || '',
                        last: postObj.repost_of.userID.name?.last || ''
                    },
                    avatar: postObj.repost_of.userID.avatar || '',
                    email: postObj.repost_of.userID.email || '',
                    description: postObj.repost_of.userID.description || ''
                }
            };
        } else {
            transformed.repost_of = null;
        }
        
        return transformed;
    }

    async getHomeFeed(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { limit = 20, cursor } = req.query;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User ID not found in request'
                });
            }

            // Get users that the current user follows
            const user = await User.findById(userId).select('following');
            if (!user) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'Could not find user profile'
                });
            }

            const following = user.following || [];

            // Build query
            const query: any = {
                userID: { $in: [...following, userId] },
                ...(cursor && { _id: { $lt: new mongoose.Types.ObjectId(cursor as string) } })
            };

            console.log('Home feed query:', JSON.stringify(query, null, 2));

            // Fetch posts with error handling
            let posts;
            try {
                const postQuery = Post.find(query)
                    .sort({ _id: -1 })
                    .limit(Number(limit) + 1);

                // Debug the query before execution
                console.log('MongoDB Query:', postQuery.getQuery());
                console.log('MongoDB Options:', postQuery.getOptions());

                posts = await postQuery
                    .populate({
                        path: 'userID',
                        select: 'username name avatar email description'
                    })
                    .populate({
                        path: 'quoted_post_id',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'repost_of',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'mentions',
                        select: 'username name avatar email description'
                    })
                    .populate('likes', '_id')
                    .populate('reposts', '_id')
                    .populate('replies', '_id')
                    .populate('bookmarks', '_id');

                console.log(`Found ${posts.length} posts`);

                // Transform posts
                posts = posts.map(post => this.transformPost(post));

            } catch (dbError: any) {
                console.error('Database error in getHomeFeed:', {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack,
                    query
                });
                return res.status(500).json({
                    error: 'Database error',
                    message: `Error fetching posts: ${dbError.message}`
                });
            }

            const hasMore = posts.length > Number(limit);
            if (hasMore) posts.pop();

            const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

            return res.json({
                data: {
                    posts,
                    nextCursor,
                    hasMore,
                    total: posts.length
                }
            });
        } catch (error: any) {
            console.error('Error in getHomeFeed:', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                error: 'Server error',
                message: `Error fetching home feed: ${error.message}`
            });
        }
    }

    async getUserFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { limit = 20, cursor } = req.query;

            console.log('getUserFeed params:', { userId, limit, cursor });

            // Validate userId
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Invalid user ID provided'
                });
            }

            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'Not found',
                    message: 'User not found'
                });
            }

            console.log('Found user:', { userId: user._id, username: user.username });

            // Validate limit
            const parsedLimit = Math.min(Number(limit) || 20, 50); // Cap at 50
            if (isNaN(parsedLimit) || parsedLimit <= 0) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Invalid limit parameter'
                });
            }

            // Validate cursor if provided
            const cursorStr = cursor as string;
            if (cursorStr && !mongoose.Types.ObjectId.isValid(cursorStr)) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Invalid cursor format'
                });
            }

            // Build query with both userID and author fields
            const query: any = {
                userID: new mongoose.Types.ObjectId(userId)
            };
            
            if (cursorStr) {
                query._id = { $lt: new mongoose.Types.ObjectId(cursorStr) };
            }

            console.log('Query:', JSON.stringify(query, null, 2));

            // Fetch posts with error handling
            let posts;
            try {
                const postQuery = Post.find(query)
                    .sort({ _id: -1 })
                    .limit(parsedLimit + 1);

                // Debug the query before execution
                console.log('MongoDB Query:', postQuery.getQuery());
                console.log('MongoDB Options:', postQuery.getOptions());

                posts = await postQuery
                    .populate({
                        path: 'userID',
                        select: 'username name avatar email description'
                    })
                    .populate({
                        path: 'quoted_post_id',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'repost_of',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'mentions',
                        select: 'username name avatar email description'
                    })
                    .populate('likes', '_id')
                    .populate('reposts', '_id')
                    .populate('replies', '_id')
                    .populate('bookmarks', '_id');

                console.log(`Found ${posts.length} posts`);

                // Transform posts
                posts = posts.map(post => this.transformPost(post));

            } catch (dbError: any) {
                console.error('Database error in getUserFeed:', {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack,
                    query
                });
                return res.status(500).json({
                    error: 'Database error',
                    message: `Error fetching posts: ${dbError.message}`
                });
            }

            const hasMore = posts.length > parsedLimit;
            if (hasMore) posts.pop();

            const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

            return res.json({
                data: {
                    posts,
                    nextCursor,
                    hasMore,
                    total: posts.length
                }
            });
        } catch (error: any) {
            console.error('Error in getUserFeed:', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                error: 'Server error',
                message: `Error fetching user feed: ${error.message}`
            });
        }
    }

    async getExploreFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { limit = 20, cursor } = req.query;
            const parsedLimit = Math.min(Number(limit) || 20, 50);

            const query: any = {
                ...(cursor && { _id: { $lt: new mongoose.Types.ObjectId(cursor as string) } })
            };

            console.log('Explore feed query:', JSON.stringify(query, null, 2));

            let posts;
            try {
                const postQuery = Post.find(query)
                    .sort({ _id: -1 })
                    .limit(parsedLimit + 1);

                posts = await postQuery
                    .populate({
                        path: 'userID',
                        select: 'username name avatar email description'
                    })
                    .populate({
                        path: 'quoted_post_id',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'repost_of',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'mentions',
                        select: 'username name avatar email description'
                    })
                    .populate('likes', '_id')
                    .populate('reposts', '_id')
                    .populate('replies', '_id')
                    .populate('bookmarks', '_id');

                // Transform posts
                posts = posts.map(post => this.transformPost(post));

            } catch (dbError: any) {
                console.error('Database error in getExploreFeed:', {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack,
                    query
                });
                return res.status(500).json({
                    error: 'Database error',
                    message: `Error fetching posts: ${dbError.message}`
                });
            }

            const hasMore = posts.length > parsedLimit;
            if (hasMore) posts.pop();

            const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

            return res.json({
                data: {
                    posts,
                    nextCursor,
                    hasMore,
                    total: posts.length
                }
            });
        } catch (error: any) {
            console.error('Error in getExploreFeed:', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                error: 'Server error',
                message: `Error fetching explore feed: ${error.message}`
            });
        }
    }

    async getHashtagFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { hashtag } = req.params;
            const { limit = 20, cursor } = req.query;
            const parsedLimit = Math.min(Number(limit) || 20, 50);

            // Find or create hashtag
            let hashtagDoc = await Hashtag.findOne({ name: hashtag.toLowerCase() });
            if (!hashtagDoc) {
                hashtagDoc = await Hashtag.create({ name: hashtag.toLowerCase() });
            }

            const query: any = {
                hashtags: hashtagDoc._id,
                ...(cursor && { _id: { $lt: new mongoose.Types.ObjectId(cursor as string) } })
            };

            console.log('Hashtag feed query:', JSON.stringify(query, null, 2));

            let posts;
            try {
                const postQuery = Post.find(query)
                    .sort({ _id: -1 })
                    .limit(parsedLimit + 1);

                posts = await postQuery
                    .populate({
                        path: 'userID',
                        select: 'username name avatar email description'
                    })
                    .populate({
                        path: 'quoted_post_id',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'repost_of',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'mentions',
                        select: 'username name avatar email description'
                    })
                    .populate('likes', '_id')
                    .populate('reposts', '_id')
                    .populate('replies', '_id')
                    .populate('bookmarks', '_id');

                // Transform posts
                posts = posts.map(post => this.transformPost(post));

            } catch (dbError: any) {
                console.error('Database error in getHashtagFeed:', {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack,
                    query
                });
                return res.status(500).json({
                    error: 'Database error',
                    message: `Error fetching posts: ${dbError.message}`
                });
            }

            const hasMore = posts.length > parsedLimit;
            if (hasMore) posts.pop();

            const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

            return res.json({
                data: {
                    posts,
                    nextCursor,
                    hasMore,
                    total: posts.length
                }
            });
        } catch (error: any) {
            console.error('Error in getHashtagFeed:', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                error: 'Server error',
                message: `Error fetching hashtag feed: ${error.message}`
            });
        }
    }

    async getBookmarksFeed(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { limit = 20, cursor } = req.query;
            
            // Extract user ID from the request, handling different formats
            const userId = req.user?.id || (req.user as any)?._id;

            // Debug authentication information
            console.log('Auth debug for bookmarks feed:', {
                hasUser: !!req.user,
                userFields: req.user ? Object.keys(req.user) : [],
                userId,
                headers: {
                    authorization: req.headers.authorization ? 'Bearer [redacted]' : 'none',
                    contentType: req.headers['content-type']
                }
            });

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User ID not found in request'
                });
            }

            // Convert string ID to ObjectId if needed
            const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

            // Build query
            const query: any = {
                bookmarks: userIdObj,
                ...(cursor && { _id: { $lt: new mongoose.Types.ObjectId(cursor as string) } })
            };

            console.log('Bookmarks feed query:', JSON.stringify(query, null, 2));

            // Fetch posts
            const posts = await Post.find(query)
                .sort({ _id: -1 })
                .limit(Number(limit) + 1)
                .populate({
                    path: 'userID',
                    select: 'username name avatar email description'
                })
                .populate({
                    path: 'quoted_post_id',
                    populate: { 
                        path: 'userID',
                        select: 'username name avatar email description'
                    }
                })
                .populate({
                    path: 'repost_of',
                    populate: {
                        path: 'userID',
                        select: 'username name avatar email description'
                    }
                })
                .populate({
                    path: 'mentions',
                    select: 'username name avatar email description'
                })
                .populate('likes', '_id')
                .populate('reposts', '_id')
                .populate('replies', '_id')
                .populate('bookmarks', '_id');

            // Check if there are more posts
            const hasMore = posts.length > Number(limit);
            if (hasMore) posts.pop(); // Remove the extra post

            // Get the next cursor
            const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

            // Transform posts to include bookmark status and proper author mapping
            const transformedPosts = posts.map(post => {
                const postObj = post.toObject();
                
                // Create a properly typed quoted post object if it exists
                let quotedPost = null;
                if (postObj.quoted_post_id && typeof postObj.quoted_post_id === 'object') {
                    const quotedPostObj = postObj.quoted_post_id as any;
                    quotedPost = {
                        ...quotedPostObj,
                        id: quotedPostObj._id,
                        author: quotedPostObj.userID
                    };
                }
                
                return {
                    ...postObj,
                    id: post._id,
                    author: postObj.userID, // Map userID to author for frontend consistency
                    isBookmarked: true,
                    _count: {
                        likes: post.likes?.length || 0,
                        reposts: post.reposts?.length || 0,
                        replies: post.replies?.length || 0,
                        bookmarks: post.bookmarks?.length || 0
                    },
                    quoted_post: quotedPost
                };
            });

            res.json({
                data: {
                    posts: transformedPosts,
                    nextCursor,
                    hasMore
                }
            });
        } catch (error) {
            console.error('Error fetching bookmarks feed:', error);
            next(createError(500, 'Error fetching bookmarks feed'));
        }
    }

    async getRepliesFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { parentId } = req.params;
            const { limit = 20, cursor } = req.query;
            const parsedLimit = Math.min(Number(limit) || 20, 50);

            if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Invalid parent post ID'
                });
            }

            const query: any = {
                in_reply_to_status_id: new mongoose.Types.ObjectId(parentId),
                ...(cursor && { _id: { $lt: new mongoose.Types.ObjectId(cursor as string) } })
            };

            console.log('Replies feed query:', JSON.stringify(query, null, 2));

            let posts;
            try {
                const postQuery = Post.find(query)
                    .sort({ _id: -1 })
                    .limit(parsedLimit + 1);

                posts = await postQuery
                    .populate({
                        path: 'userID',
                        select: 'username name avatar email description'
                    })
                    .populate({
                        path: 'quoted_post_id',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'repost_of',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'mentions',
                        select: 'username name avatar email description'
                    })
                    .populate('likes', '_id')
                    .populate('reposts', '_id')
                    .populate('replies', '_id')
                    .populate('bookmarks', '_id');

                // Transform posts
                posts = posts.map(post => this.transformPost(post));

            } catch (dbError: any) {
                console.error('Database error in getRepliesFeed:', {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack,
                    query
                });
                return res.status(500).json({
                    error: 'Database error',
                    message: `Error fetching posts: ${dbError.message}`
                });
            }

            const hasMore = posts.length > parsedLimit;
            if (hasMore) posts.pop();

            const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

            return res.json({
                data: {
                    posts,
                    nextCursor,
                    hasMore,
                    total: posts.length
                }
            });
        } catch (error: any) {
            console.error('Error in getRepliesFeed:', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                error: 'Server error',
                message: `Error fetching replies feed: ${error.message}`
            });
        }
    }

    async getPostById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            console.log('getPostById params:', { id });

            // Validate post ID
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Invalid post ID provided'
                });
            }

            // Fetch post with error handling
            let post;
            try {
                post = await Post.findById(id)
                    .populate({
                        path: 'userID',
                        select: 'username name avatar email description'
                    })
                    .populate({
                        path: 'quoted_post_id',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'repost_of',
                        populate: {
                            path: 'userID',
                            select: 'username name avatar email description'
                        }
                    })
                    .populate({
                        path: 'mentions',
                        select: 'username name avatar email description'
                    })
                    .populate('likes', '_id')
                    .populate('reposts', '_id')
                    .populate('replies', '_id')
                    .populate('bookmarks', '_id');

                if (!post) {
                    return res.status(404).json({
                        error: 'Not found',
                        message: 'Post not found'
                    });
                }

                console.log('Found post:', { id: post._id });

                // Transform post
                const transformedPost = this.transformPost(post);

                return res.json({
                    data: transformedPost
                });

            } catch (dbError: any) {
                console.error('Database error in getPostById:', {
                    error: dbError.message,
                    code: dbError.code,
                    stack: dbError.stack,
                    id
                });
                return res.status(500).json({
                    error: 'Database error',
                    message: `Error fetching post: ${dbError.message}`
                });
            }
        } catch (error: any) {
            console.error('Error in getPostById:', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                error: 'Server error',
                message: `Error fetching post: ${error.message}`
            });
        }
    }
}

export default new FeedController(); 
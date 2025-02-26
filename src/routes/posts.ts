import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  bookmarkPost,
  unbookmarkPost,
  repostPost,
  quotePost,
  getPostsByHashtag,
  getDrafts,
  getScheduledPosts
} from '../controllers/posts.controller';

const router = Router();

// Public routes
router.get('/', getPosts);
router.get('/hashtag/:hashtag', getPostsByHashtag);

// Protected routes - specific routes first
router.post('/', authMiddleware, createPost);
router.get('/drafts', authMiddleware, getDrafts);
router.get('/scheduled', authMiddleware, getScheduledPosts);

// Protected routes with parameters
router.get('/:id', getPostById);
router.put('/:id', authMiddleware, updatePost);
router.delete('/:id', authMiddleware, deletePost);
router.post('/:id/like', authMiddleware, likePost);
router.delete('/:id/like', authMiddleware, unlikePost);
router.post('/:id/bookmark', authMiddleware, bookmarkPost);
router.delete('/:id/bookmark', authMiddleware, unbookmarkPost);
router.post('/:id/repost', authMiddleware, repostPost);
router.post('/:id/quote', authMiddleware, quotePost);

export default router;

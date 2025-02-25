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
  getPostsByHashtag
} from '../controllers/posts.controller';

const router = Router();

// Public routes
router.get('/', getPosts);
router.get('/:id', getPostById);
router.get('/hashtag/:hashtag', getPostsByHashtag);

// Protected routes
router.post('/', authMiddleware, createPost);
router.put('/:id', authMiddleware, updatePost);
router.delete('/:id', authMiddleware, deletePost);

// Interaction routes
router.post('/:id/like', authMiddleware, likePost);
router.delete('/:id/like', authMiddleware, unlikePost);
router.post('/:id/bookmark', authMiddleware, bookmarkPost);
router.delete('/:id/bookmark', authMiddleware, unbookmarkPost);
router.post('/:id/repost', authMiddleware, repostPost);
router.post('/:id/quote', authMiddleware, quotePost);

export default router;

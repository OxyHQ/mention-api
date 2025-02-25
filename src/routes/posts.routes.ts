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
    repostPost,
    removeRepost,
    bookmarkPost,
    unbookmarkPost
} from '../controllers/posts.controller';

const router = Router();

// Public routes
router.get('/', getPosts);  // Public timeline/posts
router.get('/:id', getPostById);  // Public post viewing

// Protected routes
router.use(authMiddleware);

// Post CRUD operations that require auth
router.post('/', createPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

// Post actions that require auth
router.post('/:id/like', likePost);
router.delete('/:id/like', unlikePost);
router.post('/:id/repost', repostPost);
router.delete('/:id/repost', removeRepost);
router.post('/:id/bookmark', bookmarkPost);
router.delete('/:id/bookmark', unbookmarkPost);

export default router; 
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

// Protected routes
router.use(authMiddleware);

// Post CRUD
router.post('/', createPost);
router.get('/', getPosts);
router.get('/:id', getPostById);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

// Post actions
router.post('/:id/like', likePost);
router.delete('/:id/like', unlikePost);
router.post('/:id/repost', repostPost);
router.delete('/:id/repost', removeRepost);
router.post('/:id/bookmark', bookmarkPost);
router.delete('/:id/bookmark', unbookmarkPost);

export default router; 
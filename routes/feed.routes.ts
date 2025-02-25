import { Router } from 'express';
import { feedController } from '../controllers/feed.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/explore', feedController.getExploreFeed);
router.get('/hashtag/:hashtag', feedController.getHashtagFeed);

// Protected routes
router.use(authMiddleware);
router.get('/home', feedController.getHomeFeed);
router.get('/user/:userId', feedController.getUserFeed);
router.get('/bookmarks', feedController.getBookmarksFeed);
router.get('/replies/:parentId', feedController.getRepliesFeed);

export default router; 
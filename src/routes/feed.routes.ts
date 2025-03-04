import { Router } from 'express';
import { FeedController } from '../controllers/feed.controller';

const router = Router();
const feedController = new FeedController();

// Public routes
router.get('/explore', feedController.getExploreFeed.bind(feedController));
router.get('/hashtag/:hashtag', feedController.getHashtagFeed.bind(feedController));
router.get('/post/:id', feedController.getPostById.bind(feedController));

// Protected routes
router.get('/home', feedController.getHomeFeed.bind(feedController));
router.get('/user/:userId', feedController.getUserFeed.bind(feedController));
router.get('/bookmarks', feedController.getBookmarksFeed.bind(feedController));
router.get('/replies/:parentId', feedController.getRepliesFeed.bind(feedController));

export default router; 
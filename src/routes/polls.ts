import express from 'express';
import pollsController from '../controllers/polls.controller';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Create a new poll
router.post('/', authMiddleware, pollsController.createPoll);

// Get poll by ID
router.get('/:id', pollsController.getPoll);

// Vote in a poll
router.post('/:id/vote', authMiddleware, pollsController.vote);

// Get poll results
router.get('/:id/results', pollsController.getResults);

// Delete a poll
router.delete('/:id', authMiddleware, pollsController.deletePoll);

// Update a poll's post ID
router.post('/:id/update-post', authMiddleware, pollsController.updatePollPostId);

export default router; 
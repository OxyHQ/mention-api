import express from "express";
import { getSubscription, updateSubscription, cancelSubscription } from "../controllers/subscription.controller";
import { authMiddleware } from "../middleware/auth";

const router = express.Router();

router.use(authMiddleware);

router.get("/:userId", getSubscription);
router.post("/:userId", updateSubscription);
router.delete("/:userId", cancelSubscription);

export default router;
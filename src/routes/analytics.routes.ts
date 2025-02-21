import express from "express";
import { 
  getAnalytics, 
  updateAnalytics, 
  getHashtagStats, 
  getContentViewers,
  getInteractions,
  getTopPosts,
  getFollowerDetails
} from "../controllers/analytics.controller";
import { checkPremiumAccess } from "../middleware/premiumAccess";

const router = express.Router();

// Add premium check middleware to all analytics routes
router.use(checkPremiumAccess);

router.get("/", getAnalytics);
router.post("/update", updateAnalytics);
router.get("/hashtag/:hashtag", getHashtagStats);
router.get("/viewers", getContentViewers);
router.get("/interactions", getInteractions);
router.get("/top-posts", getTopPosts);
router.get("/followers", getFollowerDetails);

export default router;
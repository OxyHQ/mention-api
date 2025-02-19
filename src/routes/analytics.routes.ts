import express from "express";
import { getAnalytics, updateAnalytics, getHashtagStats } from "../controllers/analytics.controller";

const router = express.Router();

router.get("/", getAnalytics);
router.post("/update", updateAnalytics);
router.get("/hashtag/:hashtag", getHashtagStats);

export default router;
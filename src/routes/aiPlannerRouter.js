import express from "express";
import { createItinerary } from "../controllers/aiPlannerController.js";
const router = express.Router();

router.post("/ai-planner", createItinerary);
export default router;

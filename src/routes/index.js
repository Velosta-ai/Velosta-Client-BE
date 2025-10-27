import express from "express";
import authRoutes from "./authRouter.js";
import blogRoutes from "./blogRouter.js";
import aiPlanner from "./aiPlannerRouter.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/travel-blog", blogRoutes);
router.use("/velosta-ai", aiPlanner);

export default router;

import express, { json } from "express";
import authRoutes from "./authRouter.js";
import blogRoutes from "./blogRouter.js";
import aiPlanner from "./aiPlannerRouter.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/travel-blog", blogRoutes);
router.use("/velosta-ai", aiPlanner);
router.use("/test", (req, res) => {
  res.json({ message: "Yep, it's working!" });
});

export default router;

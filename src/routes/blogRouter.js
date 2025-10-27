import express from "express";

import { authenticate } from "../middlewares/authMiddleware.js";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  getBlogById,
} from "../controllers/blogController.js";

const router = express.Router();

router.post("/create-blog", authenticate, createBlog);
router.get("/all-blogs", getAllBlogs);
router.get("/view-blog/:id", getBlogById);
router.delete("/delete-blog/:id", authenticate, deleteBlog);

export default router;

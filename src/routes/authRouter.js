import express from "express";
import {
  googleAuthHandler,
  handleSignIn,
  handleSignUp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/google", googleAuthHandler);
router.post("/signup", handleSignUp);
router.post("/signin", handleSignIn);

export default router;

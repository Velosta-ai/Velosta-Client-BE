import express from "express";
import {
  googleAuthHandler,
  handleSignIn,
  handleSignUp,
} from "../controllers/authController.js";
import { googleAuth } from "../controllers/googleAuthController.js";

const router = express.Router();

router.post("/google", googleAuthHandler);
router.post("/continue-with-google", googleAuth);
router.post("/signup", handleSignUp);
router.post("/signin", handleSignIn);

export default router;

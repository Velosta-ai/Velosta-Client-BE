import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { verifyGoogleToken } from "../utils/googleUtils.js";
import bcrypt from "bcryptjs";
import express from "express";

const router = express.Router();

// Helper functions
export const signAccessToken = (user) => {
  return jwt.sign({ id: user.id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "7d", // short-lived
  });
};

const signRefreshToken = async (user) => {
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d", // long-lived
    }
  );

  // Store in DB
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id },
  });

  return refreshToken;
};

// -------------------- GOOGLE AUTH --------------------
export const googleAuthHandler = async (req, res) => {
  try {
    const { credential } = req.body;
    const googleUser = await verifyGoogleToken(credential);

    if (!googleUser) {
      return res.status(400).json({ error: "Invalid Google credential" });
    }

    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          provider: "google",
        },
      });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    res.json({ accessToken, refreshToken, user });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ error: "Auth failed" });
  }
};

// -------------------- EMAIL SIGNUP --------------------
export const handleSignUp = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, provider: "email" },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    res.status(201).json({
      message: "User created successfully",
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
};

// -------------------- EMAIL SIGNIN --------------------
export const handleSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.password)
      return res.status(400).json({ message: "Please login using Google" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken(user);
    const refreshToken = await signRefreshToken(user);

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Signin failed", error: error.message });
  }
};

// -------------------- REFRESH TOKEN --------------------
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: "No token provided" });

    // Verify token
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check token exists in DB and not revoked
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, revoked: false },
      include: { user: true },
    });

    if (!tokenRecord)
      return res.status(401).json({ message: "Invalid refresh token" });

    const user = tokenRecord.user;
    const newAccessToken = signAccessToken(user);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

export default router;

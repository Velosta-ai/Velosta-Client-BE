import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import prisma from "../config/db.js";
import { signAccessToken } from "./authController.js";

export const googleAuth = async (req, res) => {
  try {
    console.log("entred");
    const { token } = req.body; // Google ID token
    console.log(token, "holalal");

    if (!token)
      return res.status(400).json({ message: "Missing Google token" });
    console.log(token, "holalal");
    // return;
    // Verify token with Google
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
    );
    const googleData = await googleRes.json();

    if (!googleData.email) {
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const { email, name, picture } = googleData;

    // Check if user exists or create new one
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          picture,
          provider: "google",
        },
      });
    }

    // Generate JWT
    const accessToken = signAccessToken(user);

    res.status(200).json({
      message: "Google sign-in successful",
      user,
      accessToken,
    });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

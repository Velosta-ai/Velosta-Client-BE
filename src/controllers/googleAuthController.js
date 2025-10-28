import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import prisma from "../config/db.js";
import { signAccessToken } from "./authController.js";

export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token)
      return res.status(400).json({ message: "Missing Google token" });
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
    );
    const googleData = await googleRes.json();

    if (!googleData.email) {
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const { email, name, picture } = googleData;

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

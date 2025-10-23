import express from "express";

import cors from "cors";
import morgan from "morgan";

import itineraryRoutes from "./routes/itinerary.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/itinerary", itineraryRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

export default app;

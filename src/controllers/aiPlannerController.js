import { generateItinerary } from "../utils/plannerUtils.js";

export async function createItinerary(req, res) {
  try {
    const itinerary = await generateItinerary(req.body);
    res.json(itinerary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMENI_API_KEY);

export async function generateItinerary(input) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  const prompt = buildFlexiblePrompt(input);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const cleanedText = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const itinerary = JSON.parse(cleanedText);

    return {
      ...itinerary,
      generatedAt: new Date().toISOString(),
      model: "gemini-2.5-pro",
      input,
    };
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw new Error(`Failed to generate itinerary: ${error.message}`);
  }
}

function buildFlexiblePrompt(input) {
  const summaryLines = Object.entries(input)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `- ${key}: ${value.join(", ")}`;
      return `- ${key}: ${value}`;
    })
    .join("\n");

  return `
You are an expert travel planner. Using the details below (and filling gaps intelligently), create a rich, detailed, and realistic travel itinerary.

## USER PROVIDED DETAILS
${
  summaryLines ||
  "- No specific inputs provided. Ask clarifying questions if needed."
}

## TASK
Generate a complete itinerary that:
- Feels personalized to the user's inputs.
- Suggests appropriate destinations, places to eat, stay, and visit.
- Includes morning, afternoon, and evening breakdowns.
- Uses realistic durations and local context.
- Adapts flexibly even if some details are missing.

## OUTPUT FORMAT
Respond ONLY with valid JSON (no markdown, no code blocks, no explanations):

{
  "summary": "Brief 2–3 sentence trip overview",
  "destination": "Inferred or provided destination",
  "duration": "Number of days",
  "itinerary": [
    {
      "day": 1,
      "theme": "Short theme",
      "activities": [
        {
          "time": "9:00 AM",
          "title": "Activity name",
          "description": "Detailed description",
          "location": "Specific address or area",
          "category": "food|attraction|experience|transport"
        }
      ],
      "meals": {
        "breakfast": "Restaurant or local food suggestion",
        "lunch": "Restaurant or local food suggestion",
        "dinner": "Restaurant or local food suggestion"
      },
      "accommodation": "Recommended stay for this night"
    }
  ],
  "localTips": ["Local tips and cultural insights"]
}
  `;
}

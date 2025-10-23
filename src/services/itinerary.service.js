import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyDKnw3MbZB2uQ2ls70DBUPEwANgfftxvp0");

export async function generateItinerary(input) {
  validateInput(input);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  const prompt = buildPrompt(input);

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
      model: "gemini-1.5-pro",
      input: sanitizeInput(input),
    };
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw new Error(`Failed to generate itinerary: ${error.message}`);
  }
}

function buildPrompt(input) {
  const {
    destination,
    days,
    travelStyle,
    interests,
    startDate,
    travelers,
    accommodation,
    dietaryRestrictions,
    pace = "moderate",
    includeTransport = true,
    specialRequests,
  } = input;

  return `You are an expert travel planner with extensive knowledge of destinations worldwide. Create a highly detailed, personalized itinerary.

## TRAVEL DETAILS
- Destination: ${destination}
- Duration: ${days} day${days > 1 ? "s" : ""}
- Start Date: ${startDate}
- Number of Travelers: ${travelers}
- Travel Style: ${travelStyle}
- Pace: ${pace}
- Interests: ${interests.join(", ")}
${accommodation ? `- Accommodation Preference: ${accommodation}` : ""}
${
  dietaryRestrictions?.length
    ? `- Dietary Restrictions: ${dietaryRestrictions.join(", ")}`
    : ""
}
${specialRequests ? `- Special Requests: ${specialRequests}` : ""}

## INSTRUCTIONS
1. Research the destination thoroughly and consider:
   - Best times to visit attractions (avoid crowds)
   - Local events happening during the travel dates
   - Weather conditions and appropriate activities
   - Cultural etiquette and customs
   - Safety considerations

2. Create a ${pace} itinerary that:
   - Matches the ${travelStyle} budget level
   - Focuses heavily on: ${interests.join(", ")}
   - Groups nearby attractions logically
   - Includes realistic timing and travel between locations
   - Balances activities with rest time
   - Suggests breakfast, lunch, and dinner options with specific restaurant recommendations
   ${
     includeTransport
       ? "- Provides transportation options between activities"
       : ""
   }

3. For each day, provide:
   - Morning, afternoon, and evening activities
   - Specific venue names and brief descriptions
   - Estimated costs in local currency
   - Approximate duration for each activity
   - Pro tips and insider recommendations
   - Alternative options if weather is poor

## OUTPUT FORMAT
Respond ONLY with valid JSON (no markdown, no code blocks, no explanations):

{
  "destination": "${destination}",
  "summary": "Brief 2-3 sentence overview of the trip highlights",
  "bestTimeToVisit": "Information about weather and seasons",
  "budgetEstimate": {
    "perPerson": "Estimated total cost per person in local currency",
    "breakdown": "Brief breakdown of major expenses"
  },
  "essentialInfo": {
    "currency": "Local currency",
    "language": "Primary language(s)",
    "voltage": "Electrical voltage",
    "emergencyNumber": "Emergency contact number",
    "visaRequirement": "Visa requirements for major nationalities"
  },
  "packingList": ["Essential items specific to this destination and season"],
  "itinerary": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "Brief theme of the day (e.g., 'Historical Exploration')",
      "activities": [
        {
          "time": "9:00 AM",
          "title": "Activity name",
          "description": "Detailed description",
          "location": "Specific address or area",
          "duration": "2 hours",
          "cost": "Price in local currency",
          "category": "food|attraction|transport|experience",
          "bookingRequired": true/false,
          "tips": "Local tips and insider advice"
        }
      ],
      "meals": {
        "breakfast": "Restaurant name and description",
        "lunch": "Restaurant name and description",
        "dinner": "Restaurant name and description"
      },
      "accommodation": "Hotel/stay recommendation for this night",
      "estimatedCost": "Total estimated cost for the day"
    }
  ],
  "transportationGuide": {
    "gettingThere": "How to reach ${destination}",
    "gettingAround": "Best ways to move around the city",
    "apps": ["Useful transportation apps"]
  },
  "localTips": [
    "Important cultural tips, scams to avoid, best areas to stay, etc."
  ],
  "emergencyContacts": {
    "police": "Number",
    "medical": "Number",
    "embassy": "Contact for traveler's nationality"
  }
}

CRITICAL: Output ONLY the JSON object. No markdown formatting, no explanations, no code blocks.`;
}

function validateInput(input) {
  const required = [
    "destination",
    "days",
    "travelStyle",
    "interests",
    "startDate",
    "travelers",
  ];

  for (const field of required) {
    if (!input[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (input.days < 1 || input.days > 30) {
    throw new Error("Days must be between 1 and 30");
  }

  if (input.travelers < 1) {
    throw new Error("Number of travelers must be at least 1");
  }

  if (!["budget", "moderate", "luxury"].includes(input.travelStyle)) {
    throw new Error("Travel style must be budget, moderate, or luxury");
  }

  if (!Array.isArray(input.interests) || input.interests.length === 0) {
    throw new Error("Interests must be a non-empty array");
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input.startDate)) {
    throw new Error("Start date must be in YYYY-MM-DD format");
  }
}

function sanitizeInput(input) {
  const { specialRequests, ...rest } = input;
  return rest;
}

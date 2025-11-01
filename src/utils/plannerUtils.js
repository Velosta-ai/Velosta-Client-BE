import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEYS = [
  process.env.GEMENI_API_KEY1,
  process.env.GEMENI_API_KEY2,
  process.env.GEMENI_API_KEY3,
];

async function tryGenerateWithFallback(generateFn) {
  for (let i = 0; i < API_KEYS.length; i++) {
    const apiKey = API_KEYS[i];
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    try {
      return await generateFn(model, i + 1);
    } catch (error) {
      const status =
        error?.status || error?.response?.status || error?.cause?.code;

      console.warn(
        `⚠️ Gemini API key ${i + 1} failed: ${status || error.message}`
      );

      if (
        status === 429 || // Too many requests
        status === 500 ||
        status === 501 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        /overloaded|unavailable|quota|timeout/i.test(error.message)
      ) {
        console.log(`🔁 Retrying with GEMENI_API_KEY${i + 2}...`);
        continue;
      }

      throw error;
    }
  }

  throw new Error("All Gemini API keys failed. Please try again later.");
}

export async function generateItinerary(input) {
  return await tryGenerateWithFallback(async (model, keyIndex) => {
    console.log(`🧠 Using GEMENI_API_KEY${keyIndex} for itinerary generation`);

    // Check if this is a modification request
    if (input.isModificationRequest && input.currentItinerary) {
      return await handleModificationRequest(model, input);
    }

    // Initial generation
    const prompt = buildFlexiblePrompt(input);

    try {
      const result = await model.generateContent(prompt);
      let text = result.response.text();

      let cleanedText = text
        .replace(/```json\s*/gi, "")
        .replace(/```/g, "")
        .replace(/[\u0000-\u001F]+/g, "")
        .trim();

      const firstBrace = cleanedText.indexOf("{");
      const lastBrace = cleanedText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.slice(firstBrace, lastBrace + 1);
      }

      let itinerary;
      try {
        itinerary = JSON.parse(cleanedText);
      } catch (jsonError) {
        console.error("❌ Invalid JSON from Gemini:", cleanedText);
        throw new Error("Gemini returned malformed JSON: " + jsonError.message);
      }

      return {
        ...itinerary,
        generatedAt: new Date().toISOString(),
        model: "gemini-2.5-pro",
        input,
      };
    } catch (error) {
      console.error(`🚨 Error generating itinerary (key ${keyIndex}):`, error);
      throw new Error(`Failed to generate itinerary: ${error.message}`);
    }
  });
}

/**
 * Handle modification requests with conversation context
 */
async function handleModificationRequest(model, input) {
  const { userSaid, currentItinerary, conversationHistory, context } = input;

  // Build context-aware prompt
  const modificationPrompt = `
You are an expert travel planner. A user has an existing itinerary and wants to modify it.

## CURRENT ITINERARY
${JSON.stringify(currentItinerary, null, 2)}

## ORIGINAL TRIP DETAILS
${JSON.stringify(context, null, 2)}

## CONVERSATION HISTORY (last 10 messages)
${JSON.stringify(conversationHistory.slice(-10), null, 2)}

## USER'S MODIFICATION REQUEST
"${userSaid}"

## YOUR TASK
Understand what the user wants to change and generate an UPDATED itinerary that:
1. **Preserves unchanged elements** from the original itinerary
2. **Modifies only what the user requested** (e.g., "add a museum on day 2", "change budget to ₹50,000", "remove adventure activities")
3. **Maintains the same JSON structure** as the original
4. **Recalculates costs** if budget/activities change
5. **Keeps it realistic and accurate**

Common modification types to detect:
- Budget changes: "reduce budget", "I have more money", "make it cheaper"
- Activity changes: "add", "remove", "replace", "skip", "include more"
- Day-specific changes: "on day 2", "first day", "last day"
- Preference changes: "more adventure", "less shopping", "vegetarian options"
- Accommodation changes: "better hotels", "budget stays", "luxury resorts"
- Time changes: "add one more day", "reduce to 5 days"

If the request is a simple question (not a modification), respond with a text explanation in this format:
{
  "isTextResponse": true,
  "message": "Your answer here explaining something about the itinerary"
}

Otherwise, return the FULL UPDATED ITINERARY in the same JSON structure with all fields:
{
  "summary": "Updated summary reflecting changes",
  "destination": "...",
  "duration": "...",
  "totalBudget": "...",
  "budgetBreakdown": { ... },
  "itineraryTable": [ ... ],
  "expenseSummary": { ... },
  "localTips": [ ... ],
  "totalEstimatedCost": "...",
  "modificationsApplied": ["Change 1", "Change 2"]
}

CRITICAL: Return ONLY valid JSON, no extra text.
`;

  try {
    const result = await model.generateContent(modificationPrompt);
    let text = result.response.text();

    let cleanedText = text
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .replace(/[\u0000-\u001F]+/g, "")
      .trim();

    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanedText = cleanedText.slice(firstBrace, lastBrace + 1);
    }

    let response;
    try {
      response = JSON.parse(cleanedText);
    } catch (jsonError) {
      console.error("❌ Invalid JSON from Gemini:", cleanedText);
      // Fallback to text response
      return {
        isTextResponse: true,
        message:
          "I understood your request but had trouble generating the updated itinerary. Could you please rephrase your modification?",
      };
    }

    // If it's a text response, return as-is
    if (response.isTextResponse) {
      return response;
    }

    // Otherwise, it's an updated itinerary
    return {
      ...response,
      generatedAt: new Date().toISOString(),
      model: "gemini-2.5-pro",
      isModified: true,
    };
  } catch (error) {
    console.error("🚨 Error handling modification:", error);
    throw new Error(`Failed to process modification: ${error.message}`);
  }
}

/**
 * Builds initial itinerary prompt
 */
function buildFlexiblePrompt(input) {
  const {
    destination,
    dateRange,
    travelers,
    budget,
    travelVibe,
    mustVisitPlaces,
    preferences,
    travelType,
  } = input;

  const tripDuration =
    dateRange?.start && dateRange?.end
      ? calculateDays(dateRange.start, dateRange.end)
      : "unknown";

  const preferencesText = preferences
    ? Object.entries(preferences)
        .map(
          ([key, values]) =>
            `${key}: ${Array.isArray(values) ? values.join(", ") : values}`
        )
        .join("; ")
    : "Not specified";

  const summaryLines = [
    `- Destination: ${destination || "Not specified"}`,
    `- Travel Dates: ${dateRange?.start || "?"} → ${dateRange?.end || "?"}`,
    `- Duration: ${tripDuration} days`,
    `- Travel Type: ${travelType || "Not specified"}`,
    `- Travelers: ${
      travelers
        ? `${travelers.adults || 1} adults, ${travelers.children || 0} children`
        : "1 adult"
    }`,
    `- Expected Budget: ${budget || "Flexible / Not specified"}`,
    `- Travel Vibe: ${
      Array.isArray(travelVibe) && travelVibe.length > 0
        ? travelVibe.join(", ")
        : "Not specified"
    }`,
    `- Must Visit Places: ${
      Array.isArray(mustVisitPlaces) && mustVisitPlaces.length > 0
        ? mustVisitPlaces.join(", ")
        : "None specified"
    }`,
    `- Preferences: ${preferencesText}`,
  ].join("\n");

  return `
You are an expert travel planner and experience designer.
Generate a **detailed, budget-friendly, realistic travel itinerary**.

## USER DETAILS
${summaryLines}

## TASK
Create a personalized itinerary that:
- Feels natural, location-accurate, and stays within the given budget.
- Mentions actual distances (e.g., "5.4 km from Hotel Sunrise to City Palace").
- Includes food spots by name (restaurants/cafes with cuisine type & price).
- Suggests boutique or homestay options with details.
- Adds daily activity breakdowns and total daily costs.
- Ensures **total estimated cost fits the overall budget**.
- Provides local tips and insights.
- **INCLUDES A COMPREHENSIVE EXPENSE SUMMARY** at the end with detailed breakdown.

If you cannot generate valid JSON for any reason, respond with: {}

## OUTPUT FORMAT (strict JSON only - MUST match this exact structure)
{
  "summary": "Brief 2–3 sentence overview of the trip",
  "destination": "Destination name",
  "duration": "X days",
  "totalBudget": "Approx total budget (e.g., ₹60,000 or $800)",
  "budgetBreakdown": {
    "transportation": "₹10,000",
    "accommodation": "₹20,000",
    "food": "₹12,000",
    "activities": "₹10,000",
    "miscellaneous": "₹8,000"
  },
  "itineraryTable": [
    {
      "day": 1,
      "theme": "Short theme or vibe of the day",
      "rows": [
        {
          "time": "9:00 AM",
          "activity": "Activity title",
          "description": "Detailed description of the activity",
          "distance": "Aut to Jibhi: 30 kms (or 'Starting point' for first activity)",
          "pricing": "₹500 per person (or 'Free' or 'Included')"
        }
      ],
      "meals": {
        "breakfast": "Cafe Name - Recommended dish (₹X per person)",
        "lunch": "Restaurant Name - Recommended dish (₹X per person)",
        "dinner": "Restaurant Name - Recommended dish (₹X per person)"
      },
      "accommodation": "Stay Name - Brief description, Rating: 4.7/5, ₹X per night",
      "dailyCost": "₹X,XXX"
    }
  ],
  "expenseSummary": {
    "perPersonBreakdown": {
      "transportation": {
        "amount": "₹10,000",
        "details": [
          "Flight tickets: ₹8,000",
          "Local taxi/cab: ₹1,500",
          "Auto-rickshaw: ₹500"
        ]
      },
      "accommodation": {
        "amount": "₹20,000",
        "details": [
          "Hotel Day 1-2: ₹8,000",
          "Homestay Day 3-4: ₹6,000",
          "Resort Day 5-6: ₹6,000"
        ]
      },
      "food": {
        "amount": "₹12,000",
        "details": [
          "Breakfast (6 days): ₹3,000",
          "Lunch (6 days): ₹4,500",
          "Dinner (6 days): ₹4,500"
        ]
      },
      "activities": {
        "amount": "₹10,000",
        "details": [
          "Museum entry: ₹500",
          "Guided tour: ₹2,500",
          "Adventure activity: ₹4,000",
          "Shopping: ₹3,000"
        ]
      },
      "miscellaneous": {
        "amount": "₹3,000",
        "details": [
          "Tips: ₹1,000",
          "Souvenirs: ₹1,000",
          "Emergency fund: ₹1,000"
        ]
      }
    },
    "totalPerPerson": "₹55,000",
    "totalForGroup": "₹1,10,000 (for 2 adults)",
    "costSavingTips": [
      "Book flights 2-3 months in advance for 20-30% savings",
      "Use public transport where possible",
      "Eat at local restaurants instead of hotel dining"
    ]
  },
  "localTips": [
    "Short cultural or local tip related to the area",
    "Another helpful tip for travelers"
  ],
  "totalEstimatedCost": "₹XX,XXX (sum ensuring it fits the budget)"
}

CRITICAL RULES:
1. "meals" object must have simple string values for breakfast/lunch/dinner
2. "accommodation" must be a simple string
3. "dailyCost" must be included for each day
4. All arrays must contain at least one item
5. "expenseSummary" is MANDATORY with complete breakdown
6. Include specific line items in details arrays for transparency
7. Return ONLY valid JSON, no extra text
`;
}

function calculateDays(start, end) {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  } catch {
    return "unknown";
  }
}

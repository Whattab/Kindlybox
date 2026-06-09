// Generates short, personalised "why we picked this gift" notes for each
// recommended gift, using Google Gemini.
//
// Designed to be cheap, fast, and fail soft: if Gemini errors or the env
// key is missing, we return null and the caller falls back to the gift's
// regular description. The quiz never breaks because of this.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { QuizAnswers, Gift } from "./recommend";

const GEMINI_MODEL = "gemini-2.0-flash"; // cheap + fast; free tier covers it
const MAX_OUTPUT_TOKENS = 120;            // ~60 words is plenty

interface PersonalizeInput {
  answers: QuizAnswers;
  gift: Gift;
  recipientName?: string | null; // e.g. "Mom" — optional flavour
}

/**
 * Build the prompt for one gift. Kept short on purpose to keep tokens low.
 */
function buildPrompt({ answers, gift, recipientName }: PersonalizeInput): string {
  const interests = (answers.interests ?? []).filter(Boolean).join(", ");
  const fields = [
    `Recipient relation: ${answers.recipient}`,
    `Occasion: ${answers.occasion}`,
    interests ? `Their interests: ${interests}` : "",
    answers.ageGroup ? `Age group: ${answers.ageGroup}` : "",
    answers.gender ? `Gender: ${answers.gender}` : "",
    `Gift name: ${gift.name}`,
    `Gift description: ${gift.description}`,
    recipientName ? `Recipient's first name: ${recipientName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "You are writing a short \"why we picked this gift\" note for KindlyBox, a thoughtful gift recommendation service.",
    "",
    "RULES:",
    "- 2 to 3 sentences, under 60 words total.",
    "- Warm, personal, specific to this person's situation.",
    "- Write in third person referring to the recipient.",
    "- Never use the word \"perfect\" or generic salesy language.",
    "- No emoji.",
    "- Don't begin with the phrase \"For their\" — vary the opening.",
    "- Don't restate the gift name in the first sentence.",
    "",
    "DETAILS:",
    fields,
    "",
    "Write only the note. No preamble, no quotes around it.",
  ].join("\n");
}

/**
 * Generate a personalized note for one gift. Returns null on failure.
 */
async function generateOne(input: PersonalizeInput): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[personalize] GEMINI_API_KEY not set — skipping.");
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });
    const result = await model.generateContent(buildPrompt(input));
    const text = result.response.text().trim();
    // Strip wrapping quotes the model sometimes adds despite instructions.
    return text.replace(/^["']|["']$/g, "").trim();
  } catch (err) {
    console.error("[personalize] Gemini error:", err);
    return null;
  }
}

/**
 * Generate notes for an array of gifts in parallel.
 * Returns an array of strings (or nulls) matching the input order.
 */
export async function generatePersonalizedReasons(
  answers: QuizAnswers,
  gifts: Gift[],
  recipientName?: string | null,
): Promise<Array<string | null>> {
  const promises = gifts.map((gift) =>
    generateOne({ answers, gift, recipientName }),
  );
  return Promise.all(promises);
}

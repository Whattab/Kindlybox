// Generates short, personalised "why we picked this gift" notes for each
// recommended gift, using Google Gemini.
//
// Designed to be cheap, fast, and fail soft: if Gemini errors or the env
// key is missing, we return null and the caller falls back to the gift's
// regular description. The quiz never breaks because of this.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { QuizAnswers, Gift } from "./recommend";

const GEMINI_MODEL = "gemini-2.0-flash"; // aligned with the rest of the app; more stable than 2.5
const MAX_OUTPUT_TOKENS = 100;           // enough for a proper 2-sentence personalised note
const MAX_RETRIES = 2;                    // extra attempts after the first, on transient errors
const RETRY_BASE_MS = 400;                // backoff: 400ms, then 800ms

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini overload/rate-limit/transient network errors are worth retrying;
// a bad request or auth error is not.
function isRetryable(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  if (status === 503 || status === 429 || status === 500) return true;
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("overload") ||
    msg.includes("high demand") ||
    msg.includes("unavailable") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout")
  );
}

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
    recipientName ? `Recipient name: ${recipientName}` : "",
    `Occasion: ${answers.occasion}`,
    interests ? `Their interests: ${interests}` : "",
    answers.ageGroup ? `Age group: ${answers.ageGroup}` : "",
    answers.gender ? `Gender: ${answers.gender}` : "",
    answers.freeText ? `Extra notes: ${answers.freeText}` : "",
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
    "- 2 sentences, under 55 words total.",
    "- Warm, personal, and a little heartfelt, like a short card message.",
    "- Specific to this person's situation and the occasion.",
    "- Use at least one concrete detail from the extra notes when available.",
    "- Write in third person referring to the recipient.",
    "- Avoid generic salesy language and never use the word \"perfect\".",
    "- No emoji.",
    "- Don't begin with the phrase \"For their\" — vary the opening.",
    "- Don't restate the gift name in the first sentence.",
    "- Make it feel thoughtful and considered rather than promotional.",
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
function looksComplete(text: string): boolean {
  const cleaned = text.replace(/^['"]|['"]$/g, "").trim();
  if (!cleaned || cleaned.length < 20) return false;
  if (cleaned.includes("...")) return false;
  return /[.!?]$/.test(cleaned) || cleaned.split(/\s+/).length >= 8;
}

function buildFallbackNote({ answers, gift, recipientName }: PersonalizeInput): string | null {
  const freeText = (answers.freeText || "").trim();
  const occasion = answers.occasion ? answers.occasion.replace(/-/g, " ") : "this occasion";
  const recipientLabel = recipientName?.trim() || (answers.recipient === "partner"
    ? "your partner"
    : answers.recipient === "parent"
      ? "them"
      : answers.recipient === "friend"
        ? "them"
        : "them");

  // Extract a short, meaningful fragment from the gift description for specificity.
  // We take the first sentence (up to the first period) and cap at 80 chars.
  const rawDesc = (gift.description || "").trim();
  const firstSentence = rawDesc.split(".")[0].trim();
  const giftDetail = firstSentence.length > 10 && firstSentence.length <= 80
    ? firstSentence
    : rawDesc.slice(0, 80).trim();

  if (!freeText) {
    return `${giftDetail} — making it a genuinely fitting choice for ${occasion}. It strikes the right balance of thoughtfulness and practicality for ${recipientLabel}.`;
  }

  const normalized = freeText.toLowerCase();
  const hint = normalized.includes("book") || normalized.includes("reading")
    ? "their love of books and quiet time"
    : normalized.includes("cook") || normalized.includes("food")
      ? "their passion for food and the kitchen"
      : normalized.includes("travel") || normalized.includes("adventure")
        ? "their sense of adventure"
        : normalized.includes("home") || normalized.includes("decor") || normalized.includes("towel") || normalized.includes("bath")
          ? "their appreciation for home comforts"
          : normalized.includes("tech") || normalized.includes("gadget")
            ? "their interest in everyday tech"
            : normalized.includes("wellness") || normalized.includes("fitness")
              ? "their focus on wellbeing"
              : null;

  if (!hint) {
    return `${giftDetail} — a choice shaped by what you shared about ${recipientLabel}. It feels considered rather than generic, and should land well for ${occasion}.`;
  }

  return `${giftDetail} — chosen with ${hint} in mind. It feels like a natural fit for ${occasion}, personal enough to show you really thought about it.`;
}

async function generateOne(input: PersonalizeInput): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[personalize] GEMINI_API_KEY not set — skipping.");
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });
  const prompt = buildPrompt(input);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      // Strip wrapping quotes the model sometimes adds despite instructions.
      const cleaned = text.replace(/^['"]|['"]$/g, "").trim();
      return looksComplete(cleaned)
        ? cleaned
        : (buildFallbackNote(input) ?? null);
    } catch (err) {
      const willRetry = attempt < MAX_RETRIES && isRetryable(err);
      if (willRetry) {
        await sleep(RETRY_BASE_MS * 2 ** attempt); // 400ms, then 800ms
        continue;
      }
      console.error(`[personalize] Gemini error (gave up after ${attempt + 1} attempt(s)):`, err);
      return buildFallbackNote(input) ?? null;
    }
  }

  // Unreachable, but keeps the function total.
  return buildFallbackNote(input) ?? null;
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

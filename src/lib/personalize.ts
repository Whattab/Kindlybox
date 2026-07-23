// Generates short, personalised "why we picked this gift" notes for each
// recommended gift, using Google Gemini.
//
// Designed to be cheap, fast, and fail soft: if Gemini errors or the env
// key is missing, we return null and the caller falls back to the gift's
// regular description. The quiz never breaks because of this.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { QuizAnswers, Gift } from "./recommend";
import { pronounFor } from "./quiz-labels";

const GEMINI_MODEL = "gemini-2.5-flash"; // 2.0-flash was retired (404s on generateContent)
const MAX_OUTPUT_TOKENS = 120;           // plenty for a one-sentence note (real output ~25 tokens)
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
  const pronoun = pronounFor(answers.gender); // him | her | they
  const fields = [
    `Recipient relation: ${answers.recipient}`,
    recipientName ? `Recipient name: ${recipientName}` : "",
    `Refer to the recipient as: ${recipientName || pronoun}`,
    `Occasion: ${answers.occasion}`,
    interests ? `Their interests: ${interests}` : "",
    answers.ageGroup ? `Age group: ${answers.ageGroup}` : "",
    answers.freeText ? `What the buyer told us about them: ${answers.freeText}` : "",
    `Gift name: ${gift.name}`,
    `Gift description: ${gift.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "You are writing the one-line reason a gift was picked, for KindlyBox. It is shown in quotation marks, in a handwritten font, like a quick note a thoughtful friend jotted down.",
    "",
    "RULES:",
    "- ONE sentence, under 25 words. A short second clause is fine, but keep it to one sentence.",
    "- Conversational and warm, the way a friend explains why this is the one.",
    "- If the buyer's notes mention something concrete, build the line around that exact detail (e.g. \"She mentioned Sunday soups twice — this is the one she'll actually reach for\").",
    "- Focus on why it lands for THIS person, not on describing the product's features.",
    "- Refer to the recipient by name or pronoun as given above.",
    "- Never restate the gift name. No emoji. Never use the word \"perfect\".",
    "- Do not wrap the sentence in quotation marks — they are added around it automatically.",
    "",
    "DETAILS:",
    fields,
    "",
    "Write only the sentence. No preamble, no quotation marks.",
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

// Fallback when Gemini is unavailable. Kept in the same short, conversational
// voice as the prompt so it doesn't clash with the handwritten quote styling.
function buildFallbackNote({ answers, recipientName }: PersonalizeInput): string | null {
  const freeText = (answers.freeText || "").trim();
  const who = recipientName?.trim() || pronounFor(answers.gender); // name or him/her/them
  const occasion = answers.occasion ? answers.occasion.replace(/-/g, " ") : "the occasion";

  const normalized = freeText.toLowerCase();
  const hint = normalized.includes("book") || normalized.includes("reading")
    ? "their love of a good book"
    : normalized.includes("cook") || normalized.includes("food")
      ? "how much they love the kitchen"
      : normalized.includes("travel") || normalized.includes("adventure")
        ? "their itch to get out and explore"
        : normalized.includes("home") || normalized.includes("decor") || normalized.includes("towel") || normalized.includes("bath")
          ? "how much they love a cozy home"
          : normalized.includes("tech") || normalized.includes("gadget")
            ? "their soft spot for a good gadget"
            : normalized.includes("wellness") || normalized.includes("fitness")
              ? "the way they look after themselves"
              : null;

  if (hint) {
    return `Picked with ${hint} in mind — the kind of thing ${who} will actually reach for.`;
  }
  if (freeText) {
    return `Shaped by what you told us about ${who} — thoughtful without trying too hard.`;
  }
  return `A warm, fitting choice for ${who} this ${occasion} — considered, never generic.`;
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
    // thinkingConfig disables 2.5-flash's internal "thinking", which otherwise
    // eats the whole token budget (490+ tokens) and truncates the note to a
    // dangling half-sentence. It's not in the 0.24.1 SDK types yet, hence the
    // cast; the SDK forwards generationConfig to the REST body verbatim.
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingBudget: 0 },
    } as any,
  });
  const prompt = buildPrompt(input);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      // If the model still hit the token ceiling, the text is a truncated
      // fragment — don't show it; fall back to a clean note instead.
      if (result.response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        return buildFallbackNote(input) ?? null;
      }
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

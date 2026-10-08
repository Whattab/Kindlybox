// Free-text → approved tags (Step 4a). Maps a shopper's free-text note about a
// gift recipient to tags that EXIST in the taxonomy (3a `tags`/`tag_synonyms`).
// Two layers: a deterministic synonym/label match (free, reliable) and a Gemini
// pass (restricted to the approved lists). Fail-soft: if Gemini is unavailable
// the deterministic result still stands, so the quiz never breaks. The AI never
// invents tags — anything outside the vocabulary is dropped.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/utils/supabase/admin";

export interface Interpretation {
  interests: string[];   // interest-dimension labels (top-level + sub)
  avoid_flags: string[]; // avoid_flag-dimension labels
}

export interface Vocab {
  interestLabels: string[];
  avoidLabels: string[];
  synonyms: { phrase: string; label: string; dimension: string }[];
}

const GEMINI_MODEL = "gemini-2.5-flash";
const VOCAB_TTL_MS = 5 * 60 * 1000;
let _vocab: Vocab | null = null;
let _vocabAt = 0;

// Pad-and-contains whole-word matching (same idea as the blocklist).
const norm = (s: string) => " " + s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") + " ";

export async function loadVocabulary(): Promise<Vocab> {
  if (_vocab && Date.now() - _vocabAt < VOCAB_TTL_MS) return _vocab;
  const db = createServiceClient();
  const [{ data: tags }, { data: syns }] = await Promise.all([
    db.from("tags").select("id, label, dimension").eq("active", true),
    db.from("tag_synonyms").select("phrase, tag_id"),
  ]);
  const byId = new Map((tags || []).map((t: any) => [t.id, t]));
  const interestLabels = (tags || []).filter((t: any) => t.dimension === "interest").map((t: any) => t.label);
  const avoidLabels = (tags || []).filter((t: any) => t.dimension === "avoid_flag").map((t: any) => t.label);
  const synonyms = (syns || [])
    .map((s: any) => { const t: any = byId.get(s.tag_id); return t ? { phrase: s.phrase, label: t.label, dimension: t.dimension } : null; })
    .filter(Boolean) as Vocab["synonyms"];
  _vocab = { interestLabels, avoidLabels, synonyms };
  _vocabAt = Date.now();
  return _vocab;
}

/** Deterministic layer: synonym phrases + literal interest/avoid labels in the text. Pure. */
export function deterministicTags(text: string, vocab: Vocab): Interpretation {
  const hay = norm(text);
  const interests: string[] = [];
  const avoid_flags: string[] = [];
  for (const s of vocab.synonyms) {
    if (hay.includes(norm(s.phrase))) {
      if (s.dimension === "interest") interests.push(s.label);
      else if (s.dimension === "avoid_flag") avoid_flags.push(s.label);
    }
  }
  for (const l of vocab.interestLabels) if (hay.includes(norm(l))) interests.push(l);
  for (const l of vocab.avoidLabels) if (hay.includes(norm(l))) avoid_flags.push(l);
  return { interests, avoid_flags };
}

/** Keep only labels that exist in the vocabulary; dedupe; cap. Pure. */
export function finalize(parts: Interpretation[], vocab: Vocab): Interpretation {
  const iSet = new Set(vocab.interestLabels);
  const aSet = new Set(vocab.avoidLabels);
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  const interests = uniq(parts.flatMap((p) => p.interests)).filter((l) => iSet.has(l)).slice(0, 5);
  const avoid_flags = uniq(parts.flatMap((p) => p.avoid_flags)).filter((l) => aSet.has(l)).slice(0, 3);
  return { interests, avoid_flags };
}

async function aiInterpret(text: string, vocab: Vocab): Promise<Interpretation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { interests: [], avoid_flags: [] };
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.2, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } } as any,
  });
  const prompt = [
    "Map this note about a gift recipient to interest tags and \"avoid\" flags, choosing ONLY from the provided lists (exact spelling).",
    "",
    `NOTE: "${text}"`,
    "",
    `ALLOWED INTERESTS: ${vocab.interestLabels.join(", ")}`,
    `ALLOWED AVOID FLAGS: ${vocab.avoidLabels.join(", ")}`,
    "",
    "Pick the few most relevant (0-4 interests). Include sub-interests when clear (e.g. espresso → coffee). If nothing fits, use empty arrays.",
    'Return ONLY JSON: {"interests": [], "avoid_flags": []}. No prose, no code fences.',
  ].join("\n");

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(raw);
  return {
    interests: Array.isArray(parsed.interests) ? parsed.interests.map(String) : [],
    avoid_flags: Array.isArray(parsed.avoid_flags) ? parsed.avoid_flags.map(String) : [],
  };
}

/** Interpret a free-text note into approved interest + avoid-flag labels. Fail-soft. */
export async function interpretFreeText(text: string): Promise<Interpretation> {
  const t = (text || "").trim();
  if (!t) return { interests: [], avoid_flags: [] };
  let vocab: Vocab;
  try {
    vocab = await loadVocabulary();
  } catch {
    return { interests: [], avoid_flags: [] };
  }
  const det = deterministicTags(t, vocab);
  let ai: Interpretation = { interests: [], avoid_flags: [] };
  try {
    ai = await aiInterpret(t, vocab);
  } catch (e) {
    console.error("[ai-tags] Gemini interpret failed (deterministic only):", (e as any)?.message || e);
  }
  return finalize([det, ai], vocab);
}

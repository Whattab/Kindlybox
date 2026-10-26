// Free-text → approved tags (Step 4a). Maps a shopper's free-text note about a
// gift recipient to tags that EXIST in the taxonomy (3a `tags`/`tag_synonyms`).
// Two layers: a deterministic synonym/label match (free, reliable) and a Gemini
// pass (restricted to the approved lists). Fail-soft: if Gemini is unavailable
// the deterministic result still stands, so the quiz never breaks. The AI never
// invents tags — anything outside the vocabulary is dropped.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Interpretation {
  interests: string[];   // interest-dimension labels (top-level + sub)
  avoid_flags: string[]; // avoid_flag-dimension labels
}

export interface Vocab {
  interestLabels: string[];
  avoidLabels: string[];
  styleLabels: string[];
  giftTypeLabels: string[];
  occasionLabels: string[];
  recipientLabels: string[];
  subInterest: Set<string>; // interest labels that are sub-interests (ltree path has a dot)
  synonyms: { phrase: string; label: string; dimension: string }[];
}

// What AI-tagging an item (product/gift) produces — all restricted to the vocabulary.
export interface ItemTags {
  interests: string[];
  style: string[];
  gift_type: string[];
  avoid_flags: string[];
  occasions: string[];
  recipients: string[];
  primary_interest: string | null;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const VOCAB_TTL_MS = 5 * 60 * 1000;
let _vocab: Vocab | null = null;
let _vocabAt = 0;

// Pad-and-contains whole-word matching (same idea as the blocklist).
const norm = (s: string) => " " + s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") + " ";

export async function loadVocabulary(db: SupabaseClient): Promise<Vocab> {
  if (_vocab && Date.now() - _vocabAt < VOCAB_TTL_MS) return _vocab;
  const [{ data: tags }, { data: syns }] = await Promise.all([
    db.from("tags").select("id, label, dimension, path").eq("active", true),
    db.from("tag_synonyms").select("phrase, tag_id"),
  ]);
  const byId = new Map((tags || []).map((t: any) => [t.id, t]));
  const ofDim = (d: string) => (tags || []).filter((t: any) => t.dimension === d).map((t: any) => t.label);
  const interestLabels = ofDim("interest");
  const avoidLabels = ofDim("avoid_flag");
  const styleLabels = ofDim("style");
  const giftTypeLabels = ofDim("gift_type");
  const occasionLabels = ofDim("occasion");
  const recipientLabels = ofDim("recipient");
  const subInterest = new Set(
    (tags || []).filter((t: any) => t.dimension === "interest" && String(t.path || "").includes(".")).map((t: any) => t.label),
  );
  const synonyms = (syns || [])
    .map((s: any) => { const t: any = byId.get(s.tag_id); return t ? { phrase: s.phrase, label: t.label, dimension: t.dimension } : null; })
    .filter(Boolean) as Vocab["synonyms"];
  _vocab = { interestLabels, avoidLabels, styleLabels, giftTypeLabels, occasionLabels, recipientLabels, subInterest, synonyms };
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

/** primary_interest = the most specific interest (prefer a sub-interest). */
export function pickPrimaryInterest(interests: string[], vocab: Vocab): string | null {
  return interests.find((i) => vocab.subInterest.has(i)) || interests[0] || null;
}

/** Merge + validate item-tag parts against the vocabulary; cap; choose primary. Pure. */
export function finalizeItemTags(parts: Partial<ItemTags>[], vocab: Vocab): ItemTags {
  const iSet = new Set(vocab.interestLabels), aSet = new Set(vocab.avoidLabels);
  const sSet = new Set(vocab.styleLabels), gSet = new Set(vocab.giftTypeLabels);
  const oSet = new Set(vocab.occasionLabels), rSet = new Set(vocab.recipientLabels);
  const uniq = (arr: string[] = []) => Array.from(new Set(arr));
  // Cap interests at 4 (was 6) to curb magnet over-tagging (e.g. a chair bleeding into "home & kitchen").
  const interests = uniq(parts.flatMap((p) => p.interests || [])).filter((l) => iSet.has(l)).slice(0, 4);
  const avoid_flags = uniq(parts.flatMap((p) => p.avoid_flags || [])).filter((l) => aSet.has(l)).slice(0, 3);
  const style = uniq(parts.flatMap((p) => p.style || [])).filter((l) => sSet.has(l)).slice(0, 2);
  const gift_type = uniq(parts.flatMap((p) => p.gift_type || [])).filter((l) => gSet.has(l)).slice(0, 2);
  const occasions = uniq(parts.flatMap((p) => p.occasions || [])).filter((l) => oSet.has(l)).slice(0, 3);
  const recipients = uniq(parts.flatMap((p) => p.recipients || [])).filter((l) => rSet.has(l)).slice(0, 3);
  return { interests, style, gift_type, avoid_flags, occasions, recipients, primary_interest: pickPrimaryInterest(interests, vocab) };
}

async function aiTagItem(text: string, vocab: Vocab, hint?: string): Promise<Partial<ItemTags>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.2, maxOutputTokens: 320, thinkingConfig: { thinkingBudget: 0 } } as any,
  });
  const prompt = [
    "Tag this gift product, choosing ONLY from the provided lists (exact spelling). Prefer the most specific interest (e.g. a coffee grinder → coffee, not just home & kitchen).",
    "Be strict — only tags that clearly, directly apply. Do NOT add tangential ones:",
    "- a gaming/office chair is furniture, NOT \"home & kitchen\"; a pet supplement is \"pets\", NOT \"fitness & wellness\";",
    "- exercise gear is \"fitness & wellness\", NOT \"home & kitchen\"; a cologne/candle is self-care/home, NOT \"travel\".",
    "Occasions/recipients: only when the item genuinely suits them. Be careful with \"baby shower\" — tag it ONLY for newborn/nursery items (baby clothing, a nursery/newborn theme like animals, rainbow, 'baby', 'princess'). A personalized name sign with a SPORTS, GAMING, or older-kid hobby theme (gamer, basketball, football, volleyball, baseball) is NOT a baby-shower gift — use \"birthday\" or leave occasions empty. If unsure, leave them empty rather than guessing.",
    ...(hint ? ["", hint] : []),
    "",
    `PRODUCT: "${text}"`,
    "",
    `ALLOWED INTERESTS: ${vocab.interestLabels.join(", ")}`,
    `ALLOWED STYLES: ${vocab.styleLabels.join(", ")}`,
    `ALLOWED GIFT TYPES: ${vocab.giftTypeLabels.join(", ")}`,
    `ALLOWED AVOID FLAGS: ${vocab.avoidLabels.join(", ")}`,
    `ALLOWED OCCASIONS: ${vocab.occasionLabels.join(", ")}`,
    `ALLOWED RECIPIENTS: ${vocab.recipientLabels.join(", ")}`,
    "",
    "Pick 1-4 interests (include the specific sub-interest AND its parent when clear), 1-2 styles, 1 gift type, 0-3 occasions, 0-3 recipients, and any avoid flags that apply.",
    'Return ONLY JSON: {"interests":[],"style":[],"gift_type":[],"avoid_flags":[],"occasions":[],"recipients":[]}. No prose, no code fences.',
  ].join("\n");
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const p = JSON.parse(raw);
  const arr = (v: any) => (Array.isArray(v) ? v.map(String) : []);
  return { interests: arr(p.interests), style: arr(p.style), gift_type: arr(p.gift_type), avoid_flags: arr(p.avoid_flags), occasions: arr(p.occasions), recipients: arr(p.recipients) };
}

/** AI-tag a catalogue item (product/gift) into approved tags. Fail-soft.
 *  `hint` adds rules for one kind of item to the prompt (e.g. gift cards). */
export async function tagItem(title: string, description: string | null | undefined, db: SupabaseClient, hint?: string): Promise<ItemTags> {
  const text = [title, description].filter(Boolean).join(". ").trim();
  const empty: ItemTags = { interests: [], style: [], gift_type: [], avoid_flags: [], occasions: [], recipients: [], primary_interest: null };
  if (!text) return empty;
  let vocab: Vocab;
  try { vocab = await loadVocabulary(db); } catch { return empty; }
  const det = deterministicTags(text, vocab); // interests + avoid flags
  let ai: Partial<ItemTags> = {};
  try { ai = await aiTagItem(text, vocab, hint); } catch (e) {
    console.error("[ai-tags] Gemini tagItem failed (deterministic only):", (e as any)?.message || e);
  }
  return finalizeItemTags([det, ai], vocab);
}

/** Interpret a free-text note into approved interest + avoid-flag labels. Fail-soft. */
export async function interpretFreeText(text: string, db: SupabaseClient): Promise<Interpretation> {
  const t = (text || "").trim();
  if (!t) return { interests: [], avoid_flags: [] };
  let vocab: Vocab;
  try {
    vocab = await loadVocabulary(db);
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

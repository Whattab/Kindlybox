// Optional AI polish for content opportunities: turns a plain topic into a
// catchy SEO title, a content type, and a few secondary keywords.
//
// Fail-soft by design: if Gemini errors or GEMINI_API_KEY is missing, callers
// fall back to templated titles. The engine never depends on this.

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-2.5-flash";

export interface TitleEnrichment {
  suggested_title: string;
  content_type: string;
  secondary_keywords: string[];
}

export async function enrichTitles(
  topics: { topic: string; primary_keyword: string }[],
): Promise<Record<string, TitleEnrichment>> {
  const out: Record<string, TitleEnrichment> = {};
  const key = process.env.GEMINI_API_KEY;
  if (!key || topics.length === 0) return out;

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        maxOutputTokens: 900,
        temperature: 0.6,
        responseMimeType: "application/json",
        // @ts-expect-error thinkingConfig is valid at runtime; keeps output from being eaten by thinking tokens.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const list = topics.map((t, i) => `${i + 1}. topic: "${t.topic}" (keyword: "${t.primary_keyword}")`).join("\n");
    const prompt = `You are an SEO editor for KindlyBox, a gift-recommendation site.
For each gift-article topic below, return a compelling, click-worthy but honest blog title (<= 65 chars), a content_type (one of: gift_guide, listicle, how_to, comparison), and 3 short secondary keywords.

Topics:
${list}

Return ONLY a JSON array, one object per topic in order:
[{"suggested_title": "...", "content_type": "...", "secondary_keywords": ["...","...","..."]}]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const arr = JSON.parse(text) as TitleEnrichment[];
    topics.forEach((t, i) => {
      const e = arr[i];
      if (e?.suggested_title) {
        out[t.topic] = {
          suggested_title: e.suggested_title.slice(0, 90),
          content_type: e.content_type || "gift_guide",
          secondary_keywords: Array.isArray(e.secondary_keywords) ? e.secondary_keywords.slice(0, 5) : [],
        };
      }
    });
  } catch (err) {
    console.error("[intelligence] enrichTitles failed (using templates):", (err as any)?.message || err);
  }
  return out;
}

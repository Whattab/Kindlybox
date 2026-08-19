// Google Autocomplete adapter — the Phase-1 "search demand" signal.
//
// Google's suggest endpoint returns REAL search queries, ranked by popularity,
// free and keyless. It's far more reliable server-side than the unofficial
// Trends endpoint (which 404s / rate-limits from datacenter IPs). It gives us
// genuine long-tail keywords and a demand proxy (rank), marked `measured`.
// It does NOT give growth %, so "growth" stays AI-estimated until a paid
// Trends API is wired in later.

export interface SuggestResult {
  seed: string;
  suggestions: string[]; // ranked, most-popular first
}

const ENDPOINT = "https://suggestqueries.google.com/complete/search";

// Fetch autocomplete suggestions for one seed phrase. Fails soft → [].
export async function fetchSuggestions(seed: string, timeoutMs = 8000): Promise<string[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${ENDPOINT}?client=firefox&hl=en&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KindlyBoxBot/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// Harvest suggestions for many seeds (throttled a touch to stay polite).
export async function harvest(seeds: string[]): Promise<SuggestResult[]> {
  const out: SuggestResult[] = [];
  for (const seed of seeds) {
    const suggestions = await fetchSuggestions(seed);
    out.push({ seed, suggestions });
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

// A demand proxy from a query's rank within suggestions: #1 ≈ 100, tapering.
export function rankToScore(index: number, listLength: number): number {
  if (listLength <= 0) return 0;
  return Math.round(100 - (index / Math.max(listLength, 1)) * 60); // 100 → ~40
}

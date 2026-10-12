// Server-only: which S4 depth options have enough catalogue behind them.

import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/utils/supabase/admin";
import { ALL_DEPTH_IDS, MIN_DEPTH_PRODUCTS } from "./graph";

// Throws on a DB error so unstable_cache doesn't keep a failure for a day.
const countDepth = unstable_cache(
  async (): Promise<string[]> => {
    const db = createServiceClient();
    const counts = await Promise.all(
      ALL_DEPTH_IDS.map(async (id) => {
        const [p, g] = await Promise.all([
          db.from("products").select("id", { count: "exact", head: true })
            .eq("active", true).eq("in_stock", true).eq("status", "approved").contains("tags", [id]),
          db.from("gifts").select("id", { count: "exact", head: true }).eq("active", true).contains("tags", [id]),
        ]);
        if (p.error || g.error) throw p.error || g.error;
        return { id, total: (p.count || 0) + (g.count || 0) };
      }),
    );
    return counts.filter((c) => c.total >= MIN_DEPTH_PRODUCTS).map((c) => c.id);
  },
  ["quiz-v2-depth-available"],
  { revalidate: 60 * 60 * 24 },
);

/**
 * Depth options with MIN_DEPTH_PRODUCTS+ approved products and active gifts.
 * Cached for a day; fails open (all shown) so a counting hiccup never breaks
 * the quiz.
 */
export async function getAvailableDepth(): Promise<string[]> {
  try {
    return await countDepth();
  } catch (err) {
    console.error("[quiz-v2] depth count failed — showing all depth options", err);
    return ALL_DEPTH_IDS;
  }
}

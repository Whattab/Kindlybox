// Server-only: which newer quiz occasions have enough gifts to be offered.
// Same pattern as depth-available.ts — counted once a day, fails open.

import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/utils/supabase/admin";
import { merchantsHiddenEverywhere } from "@/lib/affiliate/merchant-exclusions";
import { GATED_OCCASION_IDS, MIN_OCCASION_GIFTS } from "./graph";
import { catalogueOccasion } from "./map";

// Throws on a DB error so unstable_cache doesn't keep a failure for a day.
const countOccasions = unstable_cache(
  async (): Promise<string[]> => {
    const db = createServiceClient();
    const hidden = merchantsHiddenEverywhere();
    const counts = await Promise.all(
      GATED_OCCASION_IDS.map(async (id) => {
        const label = catalogueOccasion(id);
        let products = db.from("products").select("id", { count: "exact", head: true })
          .eq("active", true).eq("in_stock", true).eq("status", "approved").contains("occasions", [label]);
        if (hidden.length) products = products.not("merchant_name", "in", `(${hidden.map((m) => `"${m}"`).join(",")})`);
        const [p, g] = await Promise.all([
          products,
          db.from("gifts").select("id", { count: "exact", head: true }).eq("active", true).contains("occasions", [label]),
        ]);
        if (p.error || g.error) throw p.error || g.error;
        return { id, total: (p.count || 0) + (g.count || 0) };
      }),
    );
    return counts.filter((c) => c.total >= MIN_OCCASION_GIFTS).map((c) => c.id);
  },
  ["quiz-v2-occasions-available"],
  { revalidate: 60 * 60 * 24 },
);

/** Gated occasions with MIN_OCCASION_GIFTS+ gifts/products. Fails open. */
export async function getAvailableOccasions(): Promise<string[]> {
  try {
    return await countOccasions();
  } catch (err) {
    console.error("[quiz-v2] occasion count failed — showing all occasions", err);
    return GATED_OCCASION_IDS;
  }
}

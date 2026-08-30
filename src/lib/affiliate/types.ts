// The one common shape every affiliate network normalizes into. The quiz and
// the rest of the app only ever see this — never a network's raw row. Adding a
// new network later means writing one connector that outputs this shape.

export interface NormalizedProduct {
  network: string;              // "awin"
  network_product_id: string;   // unique id within the network (for dedupe)
  merchant_id: string | null;
  merchant_name: string | null;
  feed_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  category: string | null;      // raw network category (kept for reference)
  tags: string[];               // mapped to KindlyBox's internal TAGS
  occasions: string[];          // mapped to internal OCCASIONS
  recipients: string[];         // mapped to internal RECIPIENTS
  gender: string;               // male | female | unisex
  affiliate_link: string;       // tracked deep link (ready to use)
  in_stock: boolean;
  raw: Record<string, string>;  // original row, for debugging / future fields
}

// A pluggable connector. Every network implements this identically so the sync
// job is network-agnostic.
export interface AffiliateConnector {
  network: string;
  // Feeds the account can actually use (joined/active only).
  activeFeeds(): Promise<{ feedId: string; name: string; size: number }[]>;
  // Raw rows for one feed.
  fetchFeed(feedId: string): Promise<Record<string, string>[]>;
  // Raw row → common shape (null if the row isn't a viable gift product).
  normalize(row: Record<string, string>, feedId: string): NormalizedProduct | null;
}

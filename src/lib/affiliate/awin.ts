// Awin connector — the first of the pluggable affiliate-network connectors.
//
// Awin product data comes from Product DATAFEEDS (CSV downloads per advertiser),
// not a live REST API. You only see feeds for advertisers you've JOINED that
// publish a feed. Two endpoints matter:
//   list:     https://productdata.awin.com/datafeed/list/apikey/<KEY>/
//   download: https://productdata.awin.com/datafeed/download/apikey/<KEY>/...
//
// Credentials (never hard-coded — set in env):
//   AWIN_API_KEY       — datafeed API key (Account → API credentials)
//   AWIN_PUBLISHER_ID  — your Awin publisher/account id
//
// This module only fetches + parses raw Awin rows. Turning them into KindlyBox's
// unified shape happens in ./normalize so the quiz never sees network specifics.

import zlib from "zlib";
import { Readable } from "stream";

const LIST_BASE = "https://productdata.awin.com/datafeed/list/apikey";
const DL_BASE = "https://productdata.awin.com/datafeed/download/apikey";

// Columns we ask Awin to include in the datafeed (order matters for the URL).
export const AWIN_COLUMNS = [
  "aw_deep_link", "product_name", "aw_product_id", "merchant_product_id",
  "merchant_image_url", "aw_image_url", "description", "merchant_category",
  "category_name", "search_price", "currency", "merchant_name", "merchant_id",
  "in_stock", "brand_name", "colour", "product_short_description",
] as const;

export interface AwinFeed {
  advertiserId: string;
  advertiserName: string;
  region: string;
  membershipStatus: string;
  feedId: string;
  feedName: string;
  language: string;
  noOfProducts: number;
}

export type AwinRow = Record<string, string>;

// The account datafeed API key. Prefer AWIN_API_KEY; otherwise pull it out of a
// full Create-a-Feed download URL (AWIN_FEED_URL), since the key is the segment
// right after /apikey/ in every feed URL.
function apiKey(): string {
  const direct = process.env.AWIN_API_KEY?.trim();
  if (direct) return direct;
  const m = (process.env.AWIN_FEED_URL || "").match(/\/apikey\/([^/]+)/);
  if (m) return m[1];
  throw new Error("Set AWIN_API_KEY (or a full AWIN_FEED_URL) in the environment");
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes ("") and CRLF. Good enough for Awin's well-formed feeds.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Turn a parsed CSV (with header row) into keyed objects.
function toObjects(rows: string[][]): AwinRow[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o: AwinRow = {};
    header.forEach((h, i) => { o[h] = r[i] ?? ""; });
    return o;
  });
}

// List every product feed this publisher account can access.
export async function listFeeds(): Promise<AwinFeed[]> {
  const url = `${LIST_BASE}/${apiKey()}/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Awin feed list failed: HTTP ${res.status}`);
  const rows = toObjects(parseCsv(await res.text()));
  return rows.map((r) => ({
    advertiserId: r["Advertiser ID"] || r["Advertiser Id"] || "",
    advertiserName: r["Advertiser Name"] || "",
    region: r["Primary Region"] || r["Region"] || "",
    membershipStatus: r["Membership Status"] || "",
    feedId: r["Feed ID"] || r["Feed Id"] || "",
    feedName: r["Feed Name"] || "",
    language: r["Language"] || "",
    noOfProducts: Number(r["No of products"] || r["Number of products"] || 0),
  })).filter((f) => f.feedId);
}

// Fetch a datafeed CSV (gzip or plain) and parse into keyed rows.
async function downloadCsvRows(url: string, label: string): Promise<AwinRow[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Awin ${label} download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Awin returns gzip; fall back to plain text if it isn't gzipped.
  let text: string;
  try { text = zlib.gunzipSync(buf).toString("utf8"); }
  catch { text = buf.toString("utf8"); }
  return toObjects(parseCsv(text));
}

// Download one advertiser feed by id, with the columns we normalize.
export async function downloadFeed(feedId: string): Promise<AwinRow[]> {
  const cols = AWIN_COLUMNS.join(",");
  const url =
    `${DL_BASE}/${apiKey()}/language/en/fid/${feedId}/columns/${cols}` +
    `/format/csv/delimiter/%2C/compression/gzip/`;
  return downloadCsvRows(url, `feed ${feedId}`);
}

// Download whatever a full Create-a-Feed URL points at (AWIN_FEED_URL) — a handy
// fallback when the account exposes a ready-made combined feed URL.
export async function downloadDirectFeed(): Promise<AwinRow[]> {
  const url = process.env.AWIN_FEED_URL?.trim();
  if (!url) throw new Error("AWIN_FEED_URL is not set");
  return downloadCsvRows(url, "custom feed URL");
}

// Stream a (possibly huge) feed and STOP once ~maxRows rows have arrived, then
// abort the download. Lets giant feeds like Printerval's 542K come in as a small
// capped slice without ever loading the whole file into memory.
export async function downloadFeedCapped(feedId: string, maxRows: number): Promise<AwinRow[]> {
  const cols = AWIN_COLUMNS.join(",");
  const url =
    `${DL_BASE}/${apiKey()}/language/en/fid/${feedId}/columns/${cols}` +
    `/format/csv/delimiter/%2C/compression/gzip/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Awin feed ${feedId} download failed: HTTP ${res.status}`);
  if (!res.body) return downloadFeed(feedId);

  const stream = Readable.fromWeb(res.body as any).pipe(zlib.createGunzip());
  let text = "";
  let newlines = 0; // rough row counter; overcount (from quoted newlines) only stops us later
  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      text += chunk.toString("utf8");
      for (let i = 0; i < chunk.length; i++) if (chunk[i] === 10) newlines++;
      if (newlines > maxRows + 5) break;
    }
  } finally {
    stream.destroy();
  }
  return toObjects(parseCsv(text)).slice(0, maxRows);
}

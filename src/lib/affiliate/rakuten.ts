// Rakuten Advertising connector — Product Search API (LinkSynergy).
//
// Flow: exchange Client ID/Secret for a bearer token at /token (scope = SID),
// then page /productsearch/1.0. The API returns XML. Like Awin/CJ this only
// fetches + shapes raw rows; ./normalize maps them into the unified `products`
// shape so the quiz never sees Rakuten specifics.
//
// Credentials (env, never hard-coded):
//   RAKUTEN_CLIENT_ID / RAKUTEN_CLIENT_SECRET — OAuth2 app credentials
//   RAKUTEN_SID                               — publisher site id (token scope)

const TOKEN_URL = "https://api.linksynergy.com/token";
const SEARCH_URL = "https://api.linksynergy.com/productsearch/1.0";

export interface RakutenRawProduct {
  sku: string | null;
  mid: string | null;
  merchantName: string | null;
  productName: string;
  linkUrl: string;
  imageUrl: string | null;
  description: string | null;
  price: number | null;
  category: string | null;
}

function creds() {
  const id = process.env.RAKUTEN_CLIENT_ID?.trim();
  const secret = process.env.RAKUTEN_CLIENT_SECRET?.trim();
  const sid = process.env.RAKUTEN_SID?.trim();
  if (!id || !secret || !sid) {
    throw new Error("Rakuten credentials missing (need RAKUTEN_CLIENT_ID, RAKUTEN_CLIENT_SECRET, RAKUTEN_SID)");
  }
  return { id, secret, sid };
}

async function getToken(): Promise<string> {
  const { id, secret, sid } = creds();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(sid)}`,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Rakuten token HTTP ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Rakuten token: no access_token in response");
  return json.access_token as string;
}

// ---- tiny XML helpers (the feed is small and regular) ---------------------
const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function tagText(scope: string, name: string): string | null {
  // `[^>]*` swallows any attributes (e.g. <price currency="USD">); `[^]` matches
  // any char incl. newlines. Avoids \s/\S so no escaping pitfalls.
  const m = scope.match(new RegExp(`<${name}[^>]*>([^]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1].trim()) : null;
}

function parseItems(xml: string): RakutenRawProduct[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const out: RakutenRawProduct[] = [];
  for (const it of items) {
    const priceRaw = tagText(it, "price");
    const price = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, "")) : NaN;
    const catBlock = it.match(/<category>[\s\S]*?<\/category>/i)?.[0] || "";
    // secondary looks like "Party & Celebration~~Gift Giving~~Gift Cards & Certificates"
    const secondary = tagText(catBlock, "secondary");
    out.push({
      sku: tagText(it, "sku"),
      mid: tagText(it, "mid"),
      merchantName: tagText(it, "merchantname"),
      productName: tagText(it, "productname") || "",
      linkUrl: tagText(it, "linkurl") || "",
      imageUrl: tagText(it, "imageurl"),
      description: tagText(it, "short"),
      price: Number.isFinite(price) && price > 0 ? price : null,
      category: secondary ? secondary.split("~~").pop()!.trim() : null,
    });
  }
  return out;
}

// Page the product search up to `cap`. Giftcards.com's whole catalogue matches
// "gift card", so that keyword pulls the account's products (it's the only
// advertiser); when more advertisers join, switch to no keyword or per-mid.
export async function fetchRakutenProducts(cap = 2000, pageSize = 100): Promise<RakutenRawProduct[]> {
  const token = await getToken();
  const out: RakutenRawProduct[] = [];
  for (let page = 1; out.length < cap; page++) {
    const url = `${SEARCH_URL}?keyword=${encodeURIComponent("gift card")}&max=${pageSize}&pagenumber=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`Rakuten productsearch HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseItems(xml);
    if (items.length === 0) break;
    out.push(...items);
    const totalPages = parseInt(tagText(xml, "TotalPages") || "1", 10);
    if (page >= totalPages) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  return out.slice(0, cap);
}

// CJ Affiliate connector — GraphQL API (https://ads.api.cj.com/query).
//
// Pulls SHOPPING products only from the advertisers this publisher has JOINED,
// with tracked click URLs (linkCode.clickUrl, generated for our website PID).
//
// Credentials (env, never hard-coded):
//   CJ_PERSONAL_ACCESS_TOKEN — Developer Portal token (Bearer auth)
//   CJ_PUBLISHER_ID          — company/publisher id (CID), for the products query
//   CJ_WEBSITE_ID            — property/website id (PID), for tracked links
//
// Like Awin, this only fetches + shapes raw rows; ./normalize maps them into the
// unified `products` shape so the quiz never sees CJ specifics.

const ENDPOINT = "https://ads.api.cj.com/query";

export interface CjRawProduct {
  id: string | null;
  title: string;
  clickUrl: string;        // tracked affiliate link (earns commission)
  imageLink: string | null;
  description: string | null;
  advertiserName: string | null;
  advertiserId: string | null;
  brand: string | null;
  price: number | null;
  currency: string;
}

function creds() {
  const token = process.env.CJ_PERSONAL_ACCESS_TOKEN?.trim();
  const cid = process.env.CJ_PUBLISHER_ID?.trim();
  const pid = process.env.CJ_WEBSITE_ID?.trim();
  if (!token || !cid || !pid) {
    throw new Error("CJ credentials missing (need CJ_PERSONAL_ACCESS_TOKEN, CJ_PUBLISHER_ID, CJ_WEBSITE_ID)");
  }
  return { token, cid, pid };
}

async function gql(query: string, token: string): Promise<any> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CJ HTTP ${res.status}`);
  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error("CJ GraphQL: " + json.errors.map((e: any) => e.message).slice(0, 2).join("; "));
  }
  return json.data;
}

// Pull joined shopping products, paginated, up to `cap`.
export async function fetchJoinedShoppingProducts(cap = 4000, pageSize = 500): Promise<CjRawProduct[]> {
  const { token, cid, pid } = creds();
  const out: CjRawProduct[] = [];
  for (let offset = 0; out.length < cap; offset += pageSize) {
    const q = `{ shoppingProducts(companyId: "${cid}", partnerStatus: JOINED, limit: ${pageSize}, offset: ${offset}) {
      count
      resultList {
        id title imageLink description advertiserName advertiserId brand
        price { amount currency }
        linkCode(pid: "${pid}") { clickUrl }
      }
    } }`;
    const data = await gql(q, token);
    const list = (data?.shoppingProducts?.resultList ?? []) as any[];
    if (list.length === 0) break;
    for (const p of list) {
      out.push({
        id: p.id ?? null,
        title: (p.title || "").trim(),
        clickUrl: (p.linkCode?.clickUrl || "").trim(),
        imageLink: (p.imageLink || "").trim() || null,
        description: (p.description || "").trim() || null,
        advertiserName: p.advertiserName || null,
        advertiserId: p.advertiserId != null ? String(p.advertiserId) : null,
        brand: p.brand || null,
        price: p.price?.amount != null ? Number(p.price.amount) : null,
        currency: p.price?.currency || "USD",
      });
      if (out.length >= cap) break;
    }
    if (list.length < pageSize) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

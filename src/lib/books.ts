// Book enrichment for the Bookshop.org affiliate flow.
//
// Given an ISBN, returns everything we need to add a book to the `gifts`
// catalogue: title, author, cover image, an optional price, and the tracked
// Bookshop affiliate link. Metadata comes from Google Books (needs
// GOOGLE_BOOKS_API_KEY) with an Open Library fallback. Prices are frequently
// missing from Google Books, so callers apply a default range when price is null.

// Public Bookshop.org affiliate id for KindlyBox (not a secret — it's in every link).
const BOOKSHOP_AFFILIATE_ID = "129087";

export interface EnrichedBook {
  isbn: string; // ISBN-13
  title: string;
  author: string | null;
  cover_url: string | null;
  price: number | null;
  affiliate_url: string;
}

export function bookshopLink(isbn13: string): string {
  return `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn13}`;
}

// Convert ISBN-10 → ISBN-13; pass through a clean ISBN-13; else null.
export function toIsbn13(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length === 13 && /^\d{13}$/.test(s)) return s;
  if (s.length === 10) {
    const core = "978" + s.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1);
    const check = (10 - (sum % 10)) % 10;
    return core + check;
  }
  return null;
}

async function fromGoogle(isbn: string): Promise<Partial<EnrichedBook> | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=US&key=${key}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    const item = j.items?.[0];
    const v = item?.volumeInfo;
    if (!v?.title) return null;
    const raw = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "";
    const cover = raw ? raw.replace(/^http:/, "https:").replace(/&?edge=curl/, "") : null;
    const price = item?.saleInfo?.retailPrice?.amount ?? item?.saleInfo?.listPrice?.amount ?? null;
    return { title: v.title, author: (v.authors || [])[0] ?? null, cover_url: cover, price };
  } catch {
    return null;
  }
}

async function fromOpenLibrary(isbn: string): Promise<Partial<EnrichedBook> | null> {
  try {
    const res = await fetch(`https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    const b = j.docs?.[0];
    if (!b?.title) return null;
    // Cover may 404 for obscure/new books; GiftImage degrades to a placeholder.
    return { title: b.title, author: (b.author_name || [])[0] ?? null, cover_url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, price: null };
  } catch {
    return null;
  }
}

export async function enrichBook(rawIsbn: string): Promise<EnrichedBook | null> {
  const isbn = toIsbn13(rawIsbn);
  if (!isbn) return null;
  const meta = (await fromGoogle(isbn)) ?? (await fromOpenLibrary(isbn));
  if (!meta?.title) return null;
  return {
    isbn,
    title: meta.title,
    author: meta.author ?? null,
    cover_url: meta.cover_url ?? null,
    price: meta.price ?? null,
    affiliate_url: bookshopLink(isbn),
  };
}

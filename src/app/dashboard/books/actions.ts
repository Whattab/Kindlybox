"use server";

import { assertAdmin } from "@/utils/admin";
import { createServiceClient } from "@/utils/supabase/admin";
import { enrichBook } from "@/lib/books";

export interface AddBooksInput {
  isbns: string;        // free text: newlines / spaces / commas
  topics: string;       // comma-separated extra tags (e.g. "cooking, food")
  recipients: string[]; // him / her / parent / child / …
  occasions: string[];  // birthday / mother's day / …
  gender: string;       // unisex | female | male
  priceMin: number;
  priceMax: number;
}

export interface AddBooksResult {
  added: { isbn: string; title: string }[];
  skipped: { isbn: string; title: string }[];
  failed: { isbn: string; reason: string }[];
}

// Bulk-add books to the curated `gifts` catalogue (which the quiz blends into
// recommendations). Each ISBN is enriched (title/author/cover + Bookshop link),
// then inserted with the batch's recipient/occasion/interest tags.
export async function addBooks(input: AddBooksInput): Promise<AddBooksResult> {
  await assertAdmin();
  const admin = createServiceClient();
  const result: AddBooksResult = { added: [], skipped: [], failed: [] };

  const list = Array.from(new Set(String(input.isbns).split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));
  const tags = Array.from(
    new Set(["books & reading", ...String(input.topics || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)]),
  );
  const recipients = (input.recipients || []).filter(Boolean);
  const occasions = (input.occasions || []).filter(Boolean);
  const gender = ["male", "female", "unisex"].includes(input.gender) ? input.gender : "unisex";
  const pMin = Number.isFinite(input.priceMin) && input.priceMin > 0 ? input.priceMin : 15;
  const pMax = Number.isFinite(input.priceMax) && input.priceMax >= pMin ? input.priceMax : Math.max(pMin, 30);

  for (const raw of list) {
    const book = await enrichBook(raw);
    if (!book) {
      result.failed.push({ isbn: raw, reason: "not found / invalid ISBN" });
      continue;
    }
    const slug = `book-${book.isbn}`;
    const { data: existing } = await admin.from("gifts").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      result.skipped.push({ isbn: book.isbn, title: book.title });
      continue;
    }
    // Known price → use it exactly; unknown → the batch's range (broader budget match).
    const priceMin = book.price ?? pMin;
    const priceMax = book.price ?? pMax;
    const { error } = await admin.from("gifts").insert({
      name: book.title,
      description: book.author ? `by ${book.author}` : null,
      image_url: book.cover_url,
      price_min: priceMin,
      price_max: priceMax,
      tags,
      occasions,
      recipients,
      gender,
      affiliate_url: book.affiliate_url,
      destination_url: book.affiliate_url,
      affiliate_network: "other",
      slug,
      active: true,
    });
    if (error) result.failed.push({ isbn: book.isbn, reason: error.message });
    else result.added.push({ isbn: book.isbn, title: book.title });
  }

  return result;
}

"use server";

import { createClient } from "@/utils/supabase/server";
import { assertAdmin } from "@/utils/admin";
import { revalidatePath } from "next/cache";
import { canonicalTag, canonicalOccasion, canonicalRecipient, canonicalGender, type VocabMatch } from "@/lib/gift-vocab";

// Turn a gift name into a URL-safe, unique slug. "Stanley Quencher!" -> "stanley-quencher"
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Parse + validate the shared gift fields from a form submission.
function readGiftFields(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim() || null;
  const image_url = ((formData.get("image_url") as string) || "").trim() || null;
  const price_min = Number(formData.get("price_min"));
  const price_max = Number(formData.get("price_max"));
  const destination_url = ((formData.get("destination_url") as string) || "").trim() || null;
  const affiliate_network = ((formData.get("affiliate_network") as string) || "amazon").trim();
  // Gender defaults to unisex; the <select> only offers valid values.
  const gender = canonicalGender((formData.get("gender") as string) || "unisex").value || "unisex";
  // Unchecked checkboxes aren't submitted, so absence = not live.
  const active = formData.get("active") !== null;

  // Multi-select checkbox groups arrive as repeated form fields.
  const tags = formData.getAll("tags") as string[];
  const occasions = formData.getAll("occasions") as string[];
  const recipients = formData.getAll("recipients") as string[];

  if (!name) throw new Error("Gift name is required");
  if (!price_min || !price_max) throw new Error("Both price min and max are required");
  if (price_max < price_min) throw new Error("Price max cannot be less than price min");

  return { name, description, image_url, price_min, price_max, destination_url, affiliate_network, gender, active, tags, occasions, recipients };
}

export async function createGift(formData: FormData) {
  await assertAdmin();
  const supabase = createClient();

  const fields = readGiftFields(formData);
  const { name } = fields;

  // Guarantee a unique slug (the /go/[slug] redirect keys off it).
  const base = slugify(name) || "gift";
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: existing } = await supabase
      .from("gifts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${suffix++}`;
  }

  const { error } = await supabase.from("gifts").insert({
    ...fields,
    slug,
    affiliate_url: `/go/${slug}`,
  });

  if (error) {
    console.error("Create gift error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/catalog");
}

export async function updateGift(id: string, formData: FormData) {
  await assertAdmin();
  const supabase = createClient();

  const fields = readGiftFields(formData);

  // slug/affiliate_url are intentionally left unchanged so existing /go links
  // and any saved results keep working even if the name is edited.
  const { error } = await supabase.from("gifts").update(fields).eq("id", id);
  if (error) {
    console.error("Update gift error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/catalog");
  revalidatePath(`/dashboard/catalog/${id}`);
}

export async function deleteGift(id: string) {
  await assertAdmin();
  const supabase = createClient();

  // gift_suggestions references gifts(id) with no cascade, so clear those first.
  await supabase.from("gift_suggestions").delete().eq("gift_id", id);

  const { error } = await supabase.from("gifts").delete().eq("id", id);
  if (error) {
    console.error("Delete gift error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/catalog");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk CSV import
// ─────────────────────────────────────────────────────────────────────────────

export type ImportRowIssue = { line: number; name: string; reason: string };
export type ImportReport = {
  imported: number;
  mode: "append" | "replace";
  failed: ImportRowIssue[];
  warnings: ImportRowIssue[];
};

const MAX_IMPORT_ROWS = 2000;

// Minimal but correct RFC-4180-ish parser: handles quoted fields containing
// commas, newlines, and escaped ("") quotes. Returns rows of raw string cells.
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  out.push(row);
  // Drop fully-blank rows (e.g. a trailing newline).
  return out.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Array-valued cells are pipe-delimited: "home & kitchen|home decor".
function parseList(cell: string | undefined): string[] {
  return (cell || "").split("|").map((v) => v.trim()).filter(Boolean);
}

function parseActive(cell: string | undefined): boolean {
  const v = (cell || "").trim().toLowerCase();
  if (v === "") return true; // default live
  return !["false", "no", "0", "n", "off", "paused"].includes(v);
}

// Tolerate "$45", "1,200", " 30 " in price cells.
function parseMoney(cell: string | undefined): number {
  return Number(String(cell || "").replace(/[$,\s]/g, ""));
}

// Resolve a list of raw values to canonical vocabulary. Case/spacing/punctuation
// differences resolve automatically; genuine typos are returned in `bad` with a
// "did you mean" suggestion when one is close.
function canonicalizeList(
  raws: string[],
  fn: (raw: string) => VocabMatch,
): { values: string[]; bad: string[] } {
  const values: string[] = [];
  const bad: string[] = [];
  for (const raw of raws) {
    const m = fn(raw);
    if (m.value) values.push(m.value);
    else bad.push(m.suggestion ? `${raw} (did you mean "${m.suggestion}"?)` : raw);
  }
  return { values, bad };
}

async function imageHeadOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.status === 200;
  } catch {
    return false;
  }
}

export async function importGiftsCsv(formData: FormData): Promise<ImportReport> {
  await assertAdmin();
  const supabase = createClient();

  const file = formData.get("file") as File | null;
  const mode = (formData.get("mode") as string) === "replace" ? "replace" : "append";
  const checkImages = formData.get("checkImages") === "on";
  if (!file || file.size === 0) throw new Error("Please choose a CSV file to import");

  const rows = parseCsv(await file.text());
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one gift row");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  for (const required of ["name", "price_min", "price_max"]) {
    if (col(required) === -1) throw new Error(`CSV is missing the required "${required}" column`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Too many rows (${dataRows.length}). Split the file into batches of ${MAX_IMPORT_ROWS} or fewer.`);
  }

  // Slug uniqueness must hold across the batch AND (for append) the existing
  // catalog. In replace mode the table is about to be cleared, so only the
  // batch matters.
  const usedSlugs = new Set<string>();
  if (mode === "append") {
    const { data: existing } = await supabase.from("gifts").select("slug");
    (existing || []).forEach((g: { slug: string }) => g.slug && usedSlugs.add(g.slug));
  }

  const failed: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];
  const toInsert: Array<Record<string, unknown> & { line: number; image_url: string | null; name: string }> = [];

  dataRows.forEach((r, i) => {
    const line = i + 2; // 1-based, +1 for the header row
    const get = (name: string) => (col(name) === -1 ? "" : (r[col(name)] ?? "").trim());
    const name = get("name");
    if (!name) {
      failed.push({ line, name: "(unnamed)", reason: "Missing name" });
      return;
    }

    const priceMin = parseMoney(get("price_min"));
    const priceMax = parseMoney(get("price_max"));
    if (!priceMin || !priceMax || Number.isNaN(priceMin) || Number.isNaN(priceMax)) {
      failed.push({ line, name, reason: "price_min and price_max must both be numbers greater than 0" });
      return;
    }
    if (priceMax < priceMin) {
      failed.push({ line, name, reason: "price_max is less than price_min" });
      return;
    }

    // Case/spacing-insensitive; stores the canonical values the scorer expects.
    const t = canonicalizeList(parseList(get("tags")), canonicalTag);
    const o = canonicalizeList(parseList(get("occasions")), canonicalOccasion);
    const rc = canonicalizeList(parseList(get("recipients")), canonicalRecipient);
    if (t.bad.length || o.bad.length || rc.bad.length) {
      const parts = [
        t.bad.length ? `tags: ${t.bad.join(", ")}` : "",
        o.bad.length ? `occasions: ${o.bad.join(", ")}` : "",
        rc.bad.length ? `recipients: ${rc.bad.join(", ")}` : "",
      ].filter(Boolean);
      failed.push({ line, name, reason: `Unknown value(s) — ${parts.join("; ")}` });
      return;
    }
    const tags = t.values;
    const occasions = o.values;
    const recipients = rc.values;

    // Optional gender column; blank = unisex.
    let gender = "unisex";
    const genderRaw = get("gender");
    if (genderRaw) {
      const gm = canonicalGender(genderRaw);
      if (!gm.value) {
        failed.push({ line, name, reason: `Unknown gender "${genderRaw}"${gm.suggestion ? ` (did you mean "${gm.suggestion}"?)` : ""}` });
        return;
      }
      gender = gm.value;
    }

    // Unique slug, same shape createGift produces.
    const base = name
      .toLowerCase().trim()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gift";
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
    usedSlugs.add(slug);

    const image_url = get("image_url") || null;
    toInsert.push({
      line,
      name,
      description: get("description") || null,
      image_url,
      price_min: priceMin,
      price_max: priceMax,
      destination_url: get("destination_url") || null,
      affiliate_network: get("affiliate_network") || "amazon",
      gender,
      active: parseActive(get("active")),
      tags,
      occasions,
      recipients,
      slug,
      affiliate_url: `/go/${slug}`,
    });
  });

  // Optional image validation — a warning, never a blocker.
  if (checkImages && toInsert.length) {
    const withImages = toInsert.filter((g) => g.image_url);
    const BATCH = 8;
    for (let i = 0; i < withImages.length; i += BATCH) {
      const slice = withImages.slice(i, i + BATCH);
      const results = await Promise.all(slice.map((g) => imageHeadOk(g.image_url as string)));
      results.forEach((ok, j) => {
        if (!ok) warnings.push({ line: slice[j].line, name: slice[j].name, reason: "Image URL did not load (imported anyway)" });
      });
    }
  }

  if (toInsert.length === 0) {
    return { imported: 0, mode, failed, warnings };
  }

  // Only touch the table once we know we have valid rows — never wipe the
  // catalog for an all-invalid file.
  if (mode === "replace") {
    await supabase.from("gift_suggestions").delete().not("id", "is", null);
    const { error: delErr } = await supabase.from("gifts").delete().not("id", "is", null);
    if (delErr) {
      console.error("Bulk import replace-delete error:", delErr);
      throw new Error(`Could not clear the existing catalog: ${delErr.message}`);
    }
  }

  const cleanRows = toInsert.map(({ line: _line, ...rest }) => rest);
  const CHUNK = 200;
  for (let i = 0; i < cleanRows.length; i += CHUNK) {
    const { error } = await supabase.from("gifts").insert(cleanRows.slice(i, i + CHUNK));
    if (error) {
      console.error("Bulk import insert error:", error);
      throw new Error(`Import failed while saving: ${error.message}`);
    }
  }

  revalidatePath("/dashboard/catalog");
  return { imported: cleanRows.length, mode, failed, warnings };
}

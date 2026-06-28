"use server";

import { createClient } from "@/utils/supabase/server";
import { assertAdmin } from "@/utils/admin";
import { revalidatePath } from "next/cache";

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
  // Unchecked checkboxes aren't submitted, so absence = not live.
  const active = formData.get("active") !== null;

  // Multi-select checkbox groups arrive as repeated form fields.
  const tags = formData.getAll("tags") as string[];
  const occasions = formData.getAll("occasions") as string[];
  const recipients = formData.getAll("recipients") as string[];

  if (!name) throw new Error("Gift name is required");
  if (!price_min || !price_max) throw new Error("Both price min and max are required");
  if (price_max < price_min) throw new Error("Price max cannot be less than price min");

  return { name, description, image_url, price_min, price_max, destination_url, affiliate_network, active, tags, occasions, recipients };
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

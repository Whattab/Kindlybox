import type { MetadataRoute } from "next";
import { createClient } from "@/utils/supabase/server";

// Search engines find new gift guides from here, so it's generated on request
// rather than baked in at build time.
export const dynamic = "force-dynamic";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/quiz`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ];

  // Anon client — RLS means only published articles can come back.
  const supabase = createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, published_at, updated_at")
    .eq("status", "PUBLISHED");

  const articleRoutes: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(a.updated_at || a.published_at || Date.now()),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}

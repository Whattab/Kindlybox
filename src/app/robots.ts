import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://kindlybox.com").replace(/\/$/, "");

// Points search engines at the sitemap; keeps private/admin and redirect URLs out of results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/go/", "/auth/", "/together/"] },
    sitemap: `${BASE}/sitemap.xml`,
  };
}

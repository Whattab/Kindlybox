/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Affiliate product images come from many retailer/CDN hosts, so allow any
    // https image host. A bad/non-image URL no longer hard-crashes a page —
    // the GiftImage component falls back to a placeholder on error.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    // The webpack filesystem cache corrupts intermittently on Windows, causing
    // recurring dev-only ChunkLoadErrors. Disable it in dev for reliability.
    if (dev) config.cache = false;
    return config;
  },
};

export default nextConfig;

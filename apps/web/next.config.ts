import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Mini-app shells are no-store, but the assets they pull are static and
  // were being refetched on every card tap.
  async headers() {
    return [
      // Font files are content-addressed by family + subset in their name,
      // so a new face means a new URL — safe to freeze for a year.
      {
        source: "/creator-os/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // The bundles keep stable names across deploys, so they are cached
      // hard but still revalidated — never permanently stale.
      {
        source: "/creator-os/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // Optional peer deps of @coinbase/cdp-sdk (pulled in via thirdweb/react)
    // that are never invoked here; stub them so webpack doesn't fail.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/svm": false,
      "@x402/extensions": false,
    };
    return config;
  },
};

export default nextConfig;

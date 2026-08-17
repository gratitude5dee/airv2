import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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

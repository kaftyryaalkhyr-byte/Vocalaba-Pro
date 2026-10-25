import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: process.env.NEXT_ASSET_PREFIX || undefined,
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;

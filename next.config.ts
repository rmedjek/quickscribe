// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* other config options you might have */
  experimental: {
    serverActions: {
      bodySizeLimit: 50 * 1024 * 1024, // 50MB in bytes
    },
  },
};

export default nextConfig;
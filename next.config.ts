// next.config.ts
import type { NextConfig, SizeLimit } from "next";
const serverActionBodyLimit = process.env.SERVER_ACTION_BODY_LIMIT_CONFIG || '50mb'; // Default to 50MB

const nextConfig: NextConfig = {
  /* other config options you might have */
  experimental: {
    serverActions: {
      bodySizeLimit: serverActionBodyLimit as SizeLimit,
    },
  },
};

export default nextConfig;
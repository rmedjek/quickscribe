// next.config.ts
import type { NextConfig, SizeLimit } from "next";

const serverActionBodyLimit = process.env.SERVER_ACTION_BODY_LIMIT_CONFIG || '50mb';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: serverActionBodyLimit as SizeLimit,
    },
  },
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      // layers: true, // Optional, try without first
    };
    return config;
  },
};

export default nextConfig;
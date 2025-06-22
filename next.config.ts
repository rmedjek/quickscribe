// next.config.ts
import type {NextConfig, SizeLimit} from "next";

const serverActionBodyLimit =
  process.env.SERVER_ACTION_BODY_LIMIT_CONFIG || "50mb";

const nextConfig: NextConfig = {
  // This section is for the server action body limit, it can remain.
  experimental: {
    serverActions: {
      bodySizeLimit: serverActionBodyLimit as SizeLimit,
    },
  },

  // This is the new section we are adding.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/u/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/a/**",
      },
    ],
  },

  // This section for webpack can also remain.
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;

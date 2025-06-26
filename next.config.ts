// next.config.ts
import type {NextConfig, SizeLimit} from "next";

const serverActionBodyLimit =
  process.env.SERVER_ACTION_BODY_LIMIT_CONFIG || "50mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: serverActionBodyLimit as SizeLimit,
    },
  },

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

  webpack(config, {isServer}) {
    // configure webpack to ignore these specific warnings from Sentry's auto-instrumentation.
    // This is safe because we know they are expected and not actual errors.
    if (isServer) {
      config.ignoreWarnings = [
        {
          module: /@opentelemetry\/instrumentation/,
          message:
            /Critical dependency: the request of a dependency is an expression/,
        },
        {
          module: /@sentry\/node/,
          message:
            /Critical dependency: the request of a dependency is an expression/,
        },
      ];
    }
    // End of fix

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;

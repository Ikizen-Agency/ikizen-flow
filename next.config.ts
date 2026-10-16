import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The ephemeral demo mode (Vercel) migrates its `/tmp` database at runtime from the SQL files in `drizzle/`.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  experimental: {
    // Task attachments allow 10 MB files; leave room for multipart overhead (Server Actions default to 1 MB).
    serverActions: { bodySizeLimit: "11mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

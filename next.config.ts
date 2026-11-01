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
    // Task attachments allow 4 MB files; leave room for multipart overhead (Server Actions default to 1 MB)
    // while staying under Vercel's 4.5 MB function body limit.
    serverActions: { bodySizeLimit: "4.25mb" },
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

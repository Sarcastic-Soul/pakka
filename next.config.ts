import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // DeepFilterNet CLI, fetched by scripts/fetch-deep-filter.mjs at prebuild.
  outputFileTracingIncludes: {
    "/api/entry/parse": ["./bin/deep-filter"],
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

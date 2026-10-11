import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Personal app behind a login: every page is dynamic, so Cache Components'
  // Suspense-everywhere model adds friction without benefit.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

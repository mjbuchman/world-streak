import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run test:e2e:local` builds into its own folder (E2E_DIST_DIR), so its dev server can run
  // alongside a developer's `npm run dev`, which Next.js otherwise refuses for one folder.
  distDir: process.env.E2E_DIST_DIR || ".next",
};

export default nextConfig;

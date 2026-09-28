import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep dev artifacts isolated so a production build cannot invalidate a running dev server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;

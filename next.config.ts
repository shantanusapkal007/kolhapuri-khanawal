import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.STATIC_EXPORT === "true" ? "export" : undefined,
};

export default nextConfig;

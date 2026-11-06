import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tesseract spawns worker threads from its own files; keep it out of the bundle.
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
};

export default nextConfig;

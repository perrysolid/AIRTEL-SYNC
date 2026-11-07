import type { NextConfig } from "next";

/**
 * One codebase, two deployments:
 *  - Backend (Render): serves /api/* — store, bots, KYC, Gemini — with a disk.
 *  - Frontend (Vercel): serves the pages; with BACKEND_URL set, every /api/*
 *    call is proxied to the backend, so the browser stays same-origin.
 */
const backend = process.env.BACKEND_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Tesseract spawns worker threads from its own files; keep it out of the bundle.
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: { "/api/**": ["./data/**"], "/api/card/**": ["./src/assets/fonts/**"] },
  async rewrites() {
    // beforeFiles: must win over the local app/api routes.
    return backend ? { beforeFiles: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }], afterFiles: [], fallback: [] } : [];
  },
};

export default nextConfig;

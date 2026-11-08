import type { NextConfig } from "next";

/**
 * One codebase, two deployments:
 *  - Backend (Render): serves /api/* — store, bots, KYC, Gemini — with a disk.
 *  - Frontend (Vercel): serves the pages; with BACKEND_URL set, every /api/*
 *    call is proxied to the backend, so the browser stays same-origin.
 *    The sales portal (/sales) is rendered by the backend too, since its
 *    records live there; its pages load their scripts from the backend.
 */
const backend = process.env.BACKEND_URL?.replace(/\/$/, "");
const renderUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
const frontendHost = (() => {
  try {
    return process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL).host : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Tesseract spawns worker threads from its own files; keep it out of the bundle.
  serverExternalPackages: ["tesseract.js"],
  // On Render, pages reached through the Vercel proxy must fetch their own build's chunks.
  assetPrefix: renderUrl || undefined,
  // Sign-in and call logging are server actions posted from the Vercel address.
  experimental: { serverActions: { allowedOrigins: frontendHost ? [frontendHost] : [] } },
  async headers() {
    // Fonts and chunks loaded cross-origin (Vercel page, Render assets) need CORS.
    return renderUrl ? [{ source: "/_next/static/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }] : [];
  },
  outputFileTracingIncludes: { "/api/**": ["./data/**"], "/api/card/**": ["./src/assets/fonts/**"] },
  async rewrites() {
    // beforeFiles: must win over the local app/api routes.
    return backend ? {
          beforeFiles: [
            { source: "/api/:path*", destination: `${backend}/api/:path*` },
            { source: "/sales", destination: `${backend}/sales` },
            { source: "/sales/:path*", destination: `${backend}/sales/:path*` },
          ],
          afterFiles: [],
          fallback: [],
        } : [];
  },
};

export default nextConfig;

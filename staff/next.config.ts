import type { NextConfig } from "next";

/**
 * The staff portal is only a front end. Every /api call goes to the one backend (Render), which holds the
 * leads, orders and staff accounts and sends the WhatsApp and Telegram updates. Proxying keeps the browser
 * on this site's own address, so the sign-in cookie is first-party.
 */
const backend = (process.env.BACKEND_URL ?? "https://airtel-sync.onrender.com").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;

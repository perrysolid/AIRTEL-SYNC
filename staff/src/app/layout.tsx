import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import "./globals.css";

const mukta = Mukta({ variable: "--font-mukta", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Accel Business Staff",
  description: "Leads to call, orders to move and every update sent to the owner on WhatsApp and Telegram.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${mukta.variable} font-sans`}>{children}</body>
    </html>
  );
}

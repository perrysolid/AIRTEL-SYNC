import type { Metadata, Viewport } from "next";
import { Mukta, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const mukta = Mukta({ variable: "--font-mukta", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700", "800"] });
const receipt = IBM_Plex_Mono({ variable: "--font-receipt", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Accel Business — get your business online in one sitting",
  description: "Tell us about your business in your language. Get the right internet, phone and digital tools with one monthly price, verify in minutes, and track everything without calling.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#e40000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${mukta.variable} ${receipt.variable} antialiased min-h-dvh`}>{children}</body>
    </html>
  );
}

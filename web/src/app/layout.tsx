import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Anek_Devanagari, Anek_Gujarati, Anek_Gurmukhi, Anek_Kannada, Anek_Latin, Anek_Malayalam, Anek_Tamil, Anek_Telugu, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Anek is one family drawn for every Indian script we speak, so Hindi, Tamil
// or Bangla headlines carry the same voice as English. Variable width + weight.
const latin = Anek_Latin({ variable: "--font-anek", subsets: ["latin"], axes: ["wdth"] });
const deva = Anek_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], axes: ["wdth"], preload: false });
const tamil = Anek_Tamil({ variable: "--font-tamil", subsets: ["tamil"], axes: ["wdth"], preload: false });
const telugu = Anek_Telugu({ variable: "--font-telugu", subsets: ["telugu"], axes: ["wdth"], preload: false });
const kannada = Anek_Kannada({ variable: "--font-kannada", subsets: ["kannada"], axes: ["wdth"], preload: false });
const gujarati = Anek_Gujarati({ variable: "--font-gujarati", subsets: ["gujarati"], axes: ["wdth"], preload: false });
const bangla = Anek_Bangla({ variable: "--font-bangla", subsets: ["bengali"], axes: ["wdth"], preload: false });
const malayalam = Anek_Malayalam({ variable: "--font-malayalam", subsets: ["malayalam"], axes: ["wdth"], preload: false });
const gurmukhi = Anek_Gurmukhi({ variable: "--font-gurmukhi", subsets: ["gurmukhi"], axes: ["wdth"], preload: false });
const receipt = IBM_Plex_Mono({ variable: "--font-receipt", subsets: ["latin"], weight: ["400", "600"] });

const fonts = [latin, deva, tamil, telugu, kannada, gujarati, bangla, malayalam, gurmukhi, receipt].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: "Accel Business — get your business online in one sitting",
  description: "Tell us about your business in your language. Get the right internet, phone and digital tools with one monthly price, verify in minutes, and track everything without calling.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0c1030",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fonts} antialiased min-h-dvh`}>{children}</body>
    </html>
  );
}

import type { Profile } from "./profile";
import type { Recommendation } from "./recommend";
import type { Quote } from "./pricing";

/** Events streamed from the advisor to any front end (web, voice, WhatsApp). */
export type Chip = { label: string; value: string };

export type AdvisorEvent =
  | { type: "session"; sessionId: string; mode: "ai" | "guided" }
  | { type: "text"; delta: string }
  | { type: "status"; label: string }
  | { type: "profile"; profile: Profile; known?: string[] }
  | { type: "bundle"; recommendation: Recommendation; quote: Quote }
  | { type: "chips"; mode: "single" | "multi"; options: Chip[] }
  | { type: "handoff"; reason: string }
  | { type: "error"; message: string }
  | { type: "done" };

export const LANGUAGES = [
  { code: "en", name: "English", native: "English", bcp47: "en-IN" },
  { code: "hi", name: "Hindi", native: "हिन्दी", bcp47: "hi-IN" },
  { code: "mr", name: "Marathi", native: "मराठी", bcp47: "mr-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", bcp47: "ta-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", bcp47: "te-IN" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", bcp47: "kn-IN" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", bcp47: "gu-IN" },
  { code: "bn", name: "Bengali", native: "বাংলা", bcp47: "bn-IN" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", bcp47: "ml-IN" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", bcp47: "pa-IN" },
] as const;
export type LangCode = (typeof LANGUAGES)[number]["code"];

export const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? "English";

import { z } from "zod";

/** Things an owner can say they need. The advisor maps free text onto these. */
export const NEEDS = [
  "internet",
  "backup_internet",
  "mobile_lines",
  "whatsapp",
  "sms",
  "website",
  "email",
  "cloud_backup",
  "pos_billing",
  "device_security",
  "firewall",
  "guest_wifi",
  "cctv",
  "business_phone",
  "toll_free",
  "static_ip",
  "multi_site_management",
  "machine_monitoring",
  "fleet_tracking",
] as const;
export type Need = (typeof NEEDS)[number];

export const NEED_LABELS: Record<Need, string> = {
  internet: "Fast, reliable internet",
  backup_internet: "Backup internet when the main line is down",
  mobile_lines: "Business mobile numbers for staff",
  whatsapp: "WhatsApp channel to reach customers",
  sms: "SMS alerts and promotions",
  website: "A website and domain",
  email: "Business email and documents",
  cloud_backup: "Automatic backup of data",
  pos_billing: "GST billing / POS and UPI payments",
  device_security: "Antivirus for PCs and phones",
  firewall: "Managed firewall / network security",
  guest_wifi: "Wi-Fi for customers",
  cctv: "CCTV cameras viewable on phone",
  business_phone: "Office phone lines / IVR",
  toll_free: "Toll-free 1800 number",
  static_ip: "Fixed IP for CCTV or remote access",
  multi_site_management: "Manage all branches centrally",
  machine_monitoring: "Machine uptime / energy monitoring",
  fleet_tracking: "GPS tracking for vehicles",
};

export const ProfileSchema = z.object({
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  segment: z.enum(["micro", "prof", "multi", "mfg"]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  cityTier: z.union([z.literal(1), z.literal(2)]).optional(),
  employees: z.number().int().min(1).max(100000).optional(),
  sites: z.number().int().min(1).max(500).optional(),
  hasGstin: z.boolean().optional(),
  /** Set from a registry lookup; false when the GSTIN is cancelled/suspended. */
  gstinActive: z.boolean().optional(),
  gstin: z.string().optional(),
  udyam: z.string().optional(),
  currentInternet: z.string().optional(),
  currentProvider: z.string().optional(),
  monthlySpend: z.number().min(0).optional(),
  fibreAvailable: z.boolean().optional(),
  needs: z.array(z.enum(NEEDS)).default([]),
  /** Quantities the owner told us; anything missing is inferred from size. */
  mobileLines: z.number().int().min(0).max(1000).optional(),
  emailUsers: z.number().int().min(0).max(1000).optional(),
  devices: z.number().int().min(0).max(1000).optional(),
  counters: z.number().int().min(0).max(200).optional(),
  cameras: z.number().int().min(0).max(500).optional(),
  vehicles: z.number().int().min(0).max(500).optional(),
  machines: z.number().int().min(0).max(500).optional(),
  language: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Business types we can map to a segment without asking. */
// Order matters: "Pharmacy chain" is multi-site, "Pharmacy" is micro.
const TYPE_HINTS: [RegExp, Profile["segment"]][] = [
  [/chain|group|franchise|outlets|branches|hotels|stays|warehouse|logistics/i, "multi"],
  [/manufactur|factory|textile|auto.?parts|\bunit\b|fabricat|plastic|packag|foundry|machin|woodcraft|workshop|garment|printing press|food processing/i, "mfg"],
  [/clinic|dental|doctor|diagnostic|lab|ca firm|chartered|account|law|legal|advocate|coaching|tuition|school|consult|architect|insurance|travel|real estate|realty|agency|studio|physio|hospital/i, "prof"],
  [/kirana|grocery|salon|parlour|pharmacy|chemist|bakery|sweet|tailor|boutique|mobile|repair|stationery|hardware|cafe|tea|dhaba|general store|florist|optic|restaurant|shop|store/i, "micro"],
];

export function inferSegment(p: Profile): Profile["segment"] {
  if (p.segment) return p.segment;
  if ((p.sites ?? 1) >= 3) return "multi";
  for (const [re, seg] of TYPE_HINTS) if (p.businessType && re.test(p.businessType)) return seg;
  if ((p.employees ?? 0) >= 50) return "mfg";
  return (p.employees ?? 1) >= 6 ? "prof" : "micro";
}

export const TIER1_CITIES = new Set([
  "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad",
]);

export const TIER2_CITIES = new Set([
  "Bhopal", "Coimbatore", "Indore", "Jaipur", "Kochi", "Lucknow", "Ludhiana", "Mysuru",
  "Nagpur", "Nashik", "Patna", "Surat", "Vadodara", "Visakhapatnam",
]);

/** Accel sells in tier 1-2 cities only; anything else is unserviceable today. */
export function tierForCity(city?: string): 1 | 2 | undefined {
  if (!city) return undefined;
  const c = city.trim().toLowerCase();
  const match = (s: Set<string>) => [...s].some((x) => x.toLowerCase() === c);
  if (match(TIER1_CITIES)) return 1;
  if (match(TIER2_CITIES)) return 2;
  return undefined;
}

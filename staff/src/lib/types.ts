export type Role = "admin" | "sales" | "partner";
export interface Me { id: string; email: string; name: string; role: Role; region?: string; partnerCode?: string }

export type Band = "hot" | "warm" | "cold";
export interface Lead {
  id: string;
  business: string;
  type: string;
  segment: string;
  city: string;
  region: string;
  language: string;
  source: string;
  stage: string;
  dropReason: string | null;
  status: string;
  statusLabel: string;
  owner: string;
  ownerName: string;
  probability: number;
  band: Band;
  reasons: { label: string; effect: number }[];
  lastTouch: { at: string; kind: string; outcome: string | null } | null;
  nextAt: string | null;
  touches: number;
}

export interface LeadDetail extends Lead {
  phone: string;
  contact: string;
  contactRole: string;
  employees: number;
  sites: number;
  turnover: string;
  gstin: boolean;
  udyam: boolean;
  internetToday: string;
  providerToday: string;
  spendToday: number;
  interests: string[];
  activity: { id: number; at: string; kind: string; outcome?: string; status?: string; note: string; nextAt?: string; staffName: string }[];
  outreach: { whatsapp: string; telegram: string; message: string };
  assignable: { id: string; name: string; role: Role; region?: string }[];
}

export interface Update { at: string; channel: string; text: string }
export interface OrderRow {
  id: string;
  createdAt: string;
  business: string;
  city: string | null;
  contact: string | null;
  phone: string | null;
  channel: string;
  partnerCode: string | null;
  leadId: string | null;
  monthly: number;
  monthlyWithGst: number;
  stage: string;
  live: boolean;
  lastUpdate: Update | null;
  updates: number;
}
export interface OrderDetail extends Omit<OrderRow, "updates"> {
  steps: { key: string; label: string; done: boolean }[];
  lines: { name: string; qty: number; monthly: number }[];
  kyc: { verdict: string; summary: string; issues: string[] } | null;
  tracks: { key: string; title: string; steps: { label: string; day: number; status: "done" | "active" | "upcoming" }[] }[];
  clockDay: number;
  liveDay: number;
  activating: boolean;
  hasFibre: boolean;
  updates: Update[];
  reach: { channel: "whatsapp" | "telegram" | "web"; note: string }[];
}

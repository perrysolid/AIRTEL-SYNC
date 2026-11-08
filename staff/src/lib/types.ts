/** admin = the manager; sales = the area salesman. */
export type Role = "admin" | "supervisor" | "sales" | "partner";
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
  /** "winback": a recoverable drop from last quarter (smb_leads.csv), ranked by the propensity model. */
  origin: "registered" | "winback";
}

export interface LeadDetail extends Lead {
  phone: string;
  /** The dataset has no numbers: this one is made up for the demo. */
  sampleNumber?: boolean;
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
  chats: { id: string; at: string; channel: string; summary: ChatSummary }[];
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
  chat: ChatSummary | null;
}

export interface ChatSummary {
  headline: string;
  needs: string[];
  offered: string | null;
  concerns: string[];
  outcome: string;
  nextStep: string;
  by: "ai" | "rules";
}

export interface FeedEvent {
  at: string;
  kind: "call" | "whatsapp" | "note" | "status" | "assign" | "order" | "verified" | "signed" | "live" | "paid" | "message" | "handoff" | "quoted" | "report";
  who: string;
  title: string;
  detail?: string;
  href?: string;
}

export interface Report { id: number; at: string; by: string; text: string }

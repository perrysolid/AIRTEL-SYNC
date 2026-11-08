import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { AdvisorSession, Order } from "./store";
import { liveDay, stepStatus, type Track } from "./tracker";
import { publicUrl } from "./bots/types";

/**
 * Chat cards: PNGs that WhatsApp and Telegram fetch by URL and show above the
 * update text, so the owner sees their plan and order status at a glance.
 * They carry no personal data (no name, phone or registration numbers).
 */

// The website's palette (globals.css), so a card in chat looks like the site it links to.
const C = { paper: "#f6f6f6", sheet: "#ffffff", ink: "#1f1f1f", soft: "#666666", rule: "#e8e8e8", brand: "#e40000", brandSoft: "#fff0f0", marigold: "#f2a900", signal: "#12a05e", mist: "#f3f3f3" };
// 1080 wide; height follows the content (chat apps show portrait images uncropped).
const SIZE = { width: 1080 };

let fonts: { name: string; data: Buffer; weight: 400 | 600 | 800; style: "normal" }[] | undefined;
function loadFonts() {
  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  fonts ??= ([
    ["Mukta-Regular.ttf", 400],
    ["Mukta-SemiBold.ttf", 600],
    ["Mukta-ExtraBold.ttf", 800],
  ] as const).map(([file, weight]) => ({ name: "Mukta", data: fs.readFileSync(path.join(dir, file)), weight, style: "normal" as const }));
  return fonts;
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const days = (n: number) => (n <= 0 ? "today" : n === 1 ? "in 1 day" : `in ${n} days`);

/** Bumps whenever the picture would change, so chat apps don't show a cached card. */
export function orderCardUrl(o: Order) {
  return publicUrl(`/api/card/order/${o.id}?v=${o.notifications.length}-${o.timeline.clockDay}-${o.lines.length}`);
}
export function quoteCardUrl(s: AdvisorSession) {
  return publicUrl(`/api/card/quote/${s.id}?v=${s.quote ? `${s.quote.monthlyWithGst}-${s.quote.term}` : 0}`);
}

function Check({ size = 30, color = C.sheet }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M5 12.5l4.2 4.2L19 7" stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Header({ right }: { right: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {/* the Accel mark and wordmark, exactly as in the site header (components/Brand.tsx) */}
        <svg width={64} height={64} viewBox="0 0 64 64">
          <rect width="64" height="64" rx="16" fill={C.brand} />
          <path d="M43 22v22M43 33a11 11 0 1 1-4.2-8.7" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
        </svg>
        <div style={{ display: "flex", fontSize: 42, letterSpacing: -1, lineHeight: 1 }}>
          <span style={{ fontWeight: 800, color: C.brand }}>accel</span>
          <span style={{ fontWeight: 400, color: C.soft, marginLeft: 10 }}>business</span>
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: C.soft, background: C.mist, padding: "8px 20px", borderRadius: 999 }}>{right}</div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: `linear-gradient(160deg, ${C.paper} 0%, ${C.brandSoft} 100%)`, padding: 56, fontFamily: "Mukta" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, background: C.sheet, borderRadius: 40, padding: 52, boxShadow: "0 20px 60px rgba(22,26,51,0.10)" }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order status card
// ---------------------------------------------------------------------------

type TrackState = "live" | "active" | "upcoming";

function trackState(tr: Track, clockDay: number): TrackState {
  const states = tr.steps.map((s) => stepStatus(s, clockDay));
  if (states.every((s) => s === "done")) return "live";
  return clockDay >= 0 ? "active" : "upcoming";
}

export function orderHeadline(o: Order): { title: string; sub: string } {
  const t = o.timeline;
  const total = liveDay(t);
  const live = t.tracks.filter((tr) => trackState(tr, t.clockDay) === "live").length;
  if (t.clockDay >= 0 && t.clockDay >= total) return { title: "Everything is live", sub: "One bill · one support number · reply HELP anytime" };
  if (o.payment) return { title: `Day ${t.clockDay} of ${total}`, sub: `${live} of ${t.tracks.length} services live · no need to call, updates come here` };
  if (o.esign) return { title: "Agreement signed", sub: "Next: set up UPI AutoPay to start activation" };
  if (o.kyc?.result.verdict === "verified") return { title: "Business verified", sub: "Next: e-sign with Aadhaar OTP" };
  if (o.kyc?.result.verdict === "needs_attention") return { title: "One thing to fix", sub: o.kyc.result.actions[0] ?? "Re-upload one document" };
  if (o.kyc?.result.verdict === "rejected") return { title: "Under review", sub: "Our team will call within 4 working hours" };
  return { title: "Order placed", sub: "Next: verify your business — about 2 minutes" };
}

export function orderCard(o: Order) {
  const t = o.timeline;
  const allLive = t.clockDay >= 0 && t.clockDay >= liveDay(t);
  const stages = [
    ["Ordered", true],
    ["Verified", o.kyc?.result.verdict === "verified"],
    ["Signed", !!o.esign],
    ["Paid", !!o.payment],
    ["Live", allLive],
  ] as const;
  const current = stages.findIndex(([, done]) => !done);
  const { title, sub } = orderHeadline(o);

  return new ImageResponse(
    (
      <Frame>
        <Header right={o.id} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, color: C.ink, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 30, color: C.soft, marginTop: 8 }}>{sub}</div>
        </div>

        {/* Journey stepper: fixed-width columns joined by connectors */}
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: 36, width: "100%" }}>
          {stages.map(([label, done], i) => [
            i > 0 ? <div key={`bar-${label}`} style={{ display: "flex", flex: 1, height: 6, marginTop: 25, borderRadius: 3, background: done ? C.signal : i === current ? C.marigold : C.rule }} /> : null,
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 112 }}>
              <div
                style={{
                  display: "flex",
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? C.signal : i === current ? C.marigold : C.sheet,
                  border: done || i === current ? "none" : `5px solid ${C.rule}`,
                  fontSize: 26,
                  fontWeight: 800,
                  color: i === current ? C.ink : C.soft,
                }}
              >
                {done ? <Check /> : String(i + 1)}
              </div>
              <div style={{ display: "flex", fontSize: 24, fontWeight: i === current ? 800 : 600, color: done || i === current ? C.ink : C.soft, marginTop: 8 }}>{label}</div>
            </div>,
          ])}
        </div>

        {/* Per-service tracks */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30, gap: 12 }}>
          {t.tracks.slice(0, 4).map((tr) => {
            const st = trackState(tr, t.clockDay);
            const next = tr.steps.find((s) => stepStatus(s, t.clockDay) !== "done");
            const color = st === "live" ? C.signal : st === "active" ? C.marigold : C.soft;
            return (
              <div key={tr.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderRadius: 20, background: C.mist }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ display: "flex", width: 20, height: 20, borderRadius: 999, background: color }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: C.ink }}>{tr.title}</div>
                    <div style={{ display: "flex", fontSize: 22, color: C.soft }}>{st === "live" ? "Live and working" : next ? `${next.label} · day ${next.dueDay}` : ""}</div>
                  </div>
                </div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: st === "upcoming" ? C.soft : C.ink, background: st === "live" ? "#dcf3e6" : st === "active" ? "#fdefc4" : C.sheet, padding: "6px 18px", borderRadius: 999 }}>
                  {st === "live" ? "Live" : st === "active" ? "Setting up" : "Waiting"}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 20, borderTop: `3px dashed ${C.rule}` }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: C.ink }}>{inr(o.quote.monthlyWithGst)}/month incl. GST</div>
          <div style={{ display: "flex", fontSize: 26, color: C.soft }}>Reply STATUS anytime</div>
        </div>
      </Frame>
    ),
    { width: SIZE.width, height: 770 + Math.min(t.tracks.length, 4) * 108, fonts: loadFonts() },
  );
}

// ---------------------------------------------------------------------------
// Quote card
// ---------------------------------------------------------------------------

// Simple line icons per catalogue category (no emoji font needed).
const ICON: Record<string, string> = {
  Connectivity: "M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01",
  Communication: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  "Cloud & Productivity": "M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z",
  Security: "M12 3l8 3v6c0 4.5-3.4 8.1-8 9-4.6-.9-8-4.5-8-9V6l8-3z",
  "IoT & Physical": "M4 8h11l5-3v12l-5-3H4zM8 14v4",
};
const TINT: Record<string, string> = { Connectivity: "#12a39a", Communication: "#3b6fd8", "Cloud & Productivity": "#7b5cd6", Security: "#d2552f", "IoT & Physical": "#c98a00" };

function CategoryIcon({ category }: { category: string }) {
  return (
    <div style={{ display: "flex", width: 60, height: 60, borderRadius: 16, background: TINT[category] ?? C.signal, alignItems: "center", justifyContent: "center" }}>
      <svg width={32} height={32} viewBox="0 0 24 24">
        <path d={ICON[category] ?? "M5 12.5l4.2 4.2L19 7"} stroke={C.sheet} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const firstSentence = (t: string, n = 58) => {
  const s = t.split(/(?<=[.;])\s|\s—\s/)[0].replace(/[.;]$/, "");
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};

export function quoteCard(s: AdvisorSession) {
  const q = s.quote!;
  const lines = q.lines.filter((l) => l.active && !l.blockedReason);
  const shown = lines.slice(0, 6);
  const who = [s.profile.businessType, s.profile.city].filter(Boolean).join(" · ");
  const pills: [string, string][] = [
    ...(q.firstLiveInDays === q.allLiveInDays
      ? ([[`All live ${days(q.allLiveInDays)}`, "#dcf3e6"]] as [string, string][])
      : ([[`First service live ${days(q.firstLiveInDays)}`, "#dcf3e6"], [`All live ${days(q.allLiveInDays)}`, "#dcf3e6"]] as [string, string][])),
    [q.setupTotal > 0 ? `Setup ${inr(q.setupTotal)} one-time` : "No setup fee", "#fdefc4"],
  ];
  if (q.savingsVsToday && q.savingsVsToday > 0) pills.unshift([`Save ${inr(q.savingsVsToday)}/month vs today`, "#dcf3e6"]);
  // Height follows the content, so a one-line plan isn't a mostly blank card.
  const height = 700 + shown.length * 122 + (lines.length > shown.length ? 44 : 0) + (pills.length > 3 ? 70 : 0);

  return new ImageResponse(
    (
      <Frame>
        <Header right={`${q.term}-month plan`} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 30, color: C.soft }}>{who ? `Your plan for ${who}` : "Your plan"}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
            <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{inr(q.monthly)}</div>
            <div style={{ display: "flex", fontSize: 36, color: C.soft, marginLeft: 14 }}>/month + GST</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: C.soft, marginTop: 6 }}>
            {inr(q.monthlyWithGst)} incl. GST · {lines.length} {lines.length === 1 ? "service" : "services"} · one bill{q.oneBillDiscount > 0 ? ` · ${inr(q.oneBillDiscount)} One Bill discount` : ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
          {shown.map((l) => (
            <div key={l.productId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 4px", borderBottom: `2px solid ${C.rule}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <CategoryIcon category={l.category} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: C.ink }}>
                    {l.name}
                    {l.qty > 1 ? <span style={{ color: C.soft, fontWeight: 600, marginLeft: 10 }}>× {l.qty}</span> : null}
                  </div>
                  <div style={{ display: "flex", fontSize: 24, color: C.soft }}>{firstSentence(l.reason)}</div>
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: C.ink }}>{inr(l.monthly)}</div>
            </div>
          ))}
          {lines.length > shown.length && <div style={{ display: "flex", fontSize: 26, color: C.soft, marginTop: 10 }}>+ {lines.length - shown.length} more on the full quote</div>}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: "auto", paddingTop: 24 }}>
          {pills.map(([text, bg]) => (
            <div key={text} style={{ display: "flex", fontSize: 26, fontWeight: 600, color: C.ink, background: bg, padding: "10px 22px", borderRadius: 999 }}>
              {text}
            </div>
          ))}
        </div>
      </Frame>
    ),
    { width: SIZE.width, height, fonts: loadFonts() },
  );
}

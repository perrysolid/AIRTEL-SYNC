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

const C = { paper: "#f5f6fa", sheet: "#ffffff", ink: "#161a33", soft: "#565b78", rule: "#e3e5ee", marigold: "#f2a900", signal: "#12a39a", mist: "#eef0f6" };
// Portrait 4:5 — chat apps show it uncropped, with room for 4 services or 6 products.
const SIZE = { width: 1080, height: 1350 };

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
        <div style={{ display: "flex", width: 64, height: 64, borderRadius: 16, background: C.ink, alignItems: "center", justifyContent: "center" }}>
          <svg width={34} height={34} viewBox="0 0 24 24">
            <path d="M12 3L21 20H16.2L12 11.6L7.8 20H3L12 3Z" fill={C.marigold} />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: C.ink }}>
          Accel<span style={{ fontWeight: 400, color: C.soft, marginLeft: 10 }}>Business</span>
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: C.soft, background: C.mist, padding: "8px 20px", borderRadius: 999 }}>{right}</div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: `linear-gradient(160deg, ${C.paper} 0%, #fff7e0 100%)`, padding: 56, fontFamily: "Mukta" }}>
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
                <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: st === "upcoming" ? C.soft : C.ink, background: st === "live" ? "#d6f2ef" : st === "active" ? "#fdefc4" : C.sheet, padding: "6px 18px", borderRadius: 999 }}>
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
    { ...SIZE, fonts: loadFonts() },
  );
}

// ---------------------------------------------------------------------------
// Quote card
// ---------------------------------------------------------------------------

export function quoteCard(s: AdvisorSession) {
  const q = s.quote!;
  const lines = q.lines.filter((l) => l.active && !l.blockedReason);
  const shown = lines.slice(0, 6);
  const who = [s.profile.businessType, s.profile.city].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <Frame>
        <Header right={`${q.term}-month plan`} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <div style={{ display: "flex", fontSize: 30, color: C.soft }}>{who ? `Your plan for ${who}` : "Your plan"}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
            <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{inr(q.monthly)}</div>
            <div style={{ display: "flex", fontSize: 36, color: C.soft, marginLeft: 14 }}>/month + GST</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: C.soft, marginTop: 6 }}>
            {inr(q.monthlyWithGst)} incl. GST · {lines.length} services · one bill{q.oneBillDiscount > 0 ? ` · ${inr(q.oneBillDiscount)} One Bill discount` : ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 34, gap: 4, flex: 1 }}>
          {shown.map((l) => (
            <div key={l.productId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px", borderBottom: `2px solid ${C.rule}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ display: "flex", width: 44, height: 44, borderRadius: 12, background: C.signal, alignItems: "center", justifyContent: "center" }}>
                  <Check size={26} />
                </div>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: C.ink }}>
                  {l.name}
                  {l.qty > 1 ? <span style={{ color: C.soft, marginLeft: 10 }}>× {l.qty}</span> : null}
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: C.ink }}>{inr(l.monthly)}</div>
            </div>
          ))}
          {lines.length > shown.length && <div style={{ display: "flex", fontSize: 26, color: C.soft, marginTop: 8 }}>+ {lines.length - shown.length} more on the full quote</div>}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 20 }}>
          {[
            [`First service live ${days(q.firstLiveInDays)}`, "#d6f2ef"],
            [`All live ${days(q.allLiveInDays)}`, "#d6f2ef"],
            [q.setupTotal > 0 ? `Setup ${inr(q.setupTotal)} one-time` : "No setup fee", "#fdefc4"],
          ].map(([text, bg]) => (
            <div key={text} style={{ display: "flex", fontSize: 26, fontWeight: 600, color: C.ink, background: bg, padding: "10px 22px", borderRadius: 999 }}>
              {text}
            </div>
          ))}
        </div>
      </Frame>
    ),
    { ...SIZE, fonts: loadFonts() },
  );
}

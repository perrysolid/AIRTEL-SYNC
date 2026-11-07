"use client";

import { Minus, Plus } from "lucide-react";
import type { Quote, QuoteLine } from "@/lib/pricing";
import { inr } from "@/lib/format";

/**
 * The quote as a shop bill: every line the owner pays for, one total.
 * Interactive on the quote page (toggle add-ons, change quantities).
 */
export function Bill({
  quote,
  businessName,
  compact = false,
  onToggle,
  onQty,
}: {
  quote: Quote;
  businessName?: string;
  compact?: boolean;
  onToggle?: (id: string, on: boolean) => void;
  onQty?: (id: string, qty: number) => void;
}) {
  const included = quote.lines.filter((l) => l.active);
  const addOns = quote.lines.filter((l) => !l.active);
  return (
    <div className="receipt rounded-t-xl px-4 pt-4 text-[13px] text-ink shadow-[0_1px_0_var(--rule)]">
      <div className="text-center">
        <div className="font-semibold">ACCEL BUSINESS</div>
        {businessName && <div className="text-ink-soft">for {businessName}</div>}
        <div className="text-ink-soft">{quote.term}-month plan · prices per month</div>
      </div>
      <div className="my-3 border-t border-dashed border-rule" />
      <ul className="space-y-2.5">
        {included.map((l) => (
          <Line key={l.productId} l={l} compact={compact} onToggle={onToggle} onQty={onQty} />
        ))}
      </ul>
      {!compact && addOns.length > 0 && (
        <>
          <div className="mt-4 mb-2 font-sans text-sm font-semibold">Add if you like</div>
          <ul className="space-y-2.5">
            {addOns.map((l) => (
              <Line key={l.productId} l={l} compact={compact} onToggle={onToggle} onQty={onQty} />
            ))}
          </ul>
        </>
      )}
      <div className="my-3 border-t border-dashed border-rule" />
      <Row label="Subtotal" value={inr(quote.subtotal)} />
      {quote.oneBillDiscount > 0 && <Row label="One Bill discount (5%)" value={`− ${inr(quote.oneBillDiscount)}`} accent />}
      <Row label="GST 18%" value={inr(quote.gst)} />
      <div className="mt-2 flex items-baseline justify-between border-t-2 border-brand pt-2">
        <span className="font-semibold">TOTAL / MONTH</span>
        <span className="text-2xl font-semibold tabular-nums">{inr(quote.monthlyWithGst)}</span>
      </div>
      <div className="mt-1 text-right text-ink-soft">{inr(quote.monthly)} + GST</div>
      {quote.setupTotal + quote.setupSaved > 0 && (
        <div className="mt-2">
          <Row label="One-time setup" value={inr(quote.setupTotal)} />
          {quote.setupSaved > 0 && <div className="text-right text-ok">you save {inr(quote.setupSaved)} on setup</div>}
        </div>
      )}
      {quote.savingsVsToday !== undefined && quote.savingsVsToday > 0 && (
        <div className="mt-3 rounded-md bg-ok/10 px-2 py-1.5 text-center font-sans text-sm font-semibold text-ok">
          {inr(quote.savingsVsToday)} less than you pay for telecom today
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-baseline ${accent ? "text-ok" : ""}`}>
      <span>{label}</span>
      <span className="dotted-fill" />
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Line({ l, compact, onToggle, onQty }: { l: QuoteLine; compact: boolean; onToggle?: (id: string, on: boolean) => void; onQty?: (id: string, qty: number) => void }) {
  const unit = l.unit.replace("per ", "");
  return (
    <li className={l.blockedReason ? "opacity-60" : l.active ? "" : "text-ink-soft"}>
      <div className="flex items-baseline">
        {onToggle && (
          <label className="mr-2 inline-flex translate-y-0.5 cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={l.active}
              onChange={(e) => onToggle(l.productId, e.target.checked)}
              aria-label={`${l.active ? "Remove" : "Add"} ${l.name}`}
            />
            <span className="relative h-5 w-9 rounded-full bg-rule transition-colors peer-checked:bg-brand peer-focus-visible:outline-3 peer-focus-visible:outline-marigold after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-sheet after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        )}
        <span className="font-semibold">{l.name}</span>
        <span className="dotted-fill" />
        <span className="tabular-nums">{inr(l.monthly)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 pl-0 text-ink-soft">
        {onQty && l.active ? (
          <span className="inline-flex items-center gap-1">
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-rule hover:bg-paper disabled:opacity-40" onClick={() => onQty(l.productId, l.qty - 1)} disabled={l.qty <= 1} aria-label={`Fewer ${unit}s`}>
              <Minus size={12} />
            </button>
            <span className="min-w-14 text-center tabular-nums">{l.qty} × {inr(l.unitPrice)}</span>
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-rule hover:bg-paper" onClick={() => onQty(l.productId, l.qty + 1)} aria-label={`More ${unit}s`}>
              <Plus size={12} />
            </button>
            <span className="ml-1">{unit}</span>
          </span>
        ) : (
          <span>{l.qty > 1 ? `${l.qty} ${unit}s × ${inr(l.unitPrice)}` : `1 ${unit}`}</span>
        )}
        {l.setup > 0 && <span>setup {inr(l.setup)}</span>}
      </div>
      {!compact && <div className="mt-0.5 font-sans text-[13px] leading-snug text-ink-soft">{l.reason}</div>}
      {l.blockedReason && <div className="mt-0.5 font-sans text-[13px] text-bad">{l.blockedReason}</div>}
    </li>
  );
}

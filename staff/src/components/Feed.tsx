import Link from "next/link";
import { BadgeCheck, CircleDollarSign, ClipboardList, FileSignature, Hand, Megaphone, MessageCircle, PhoneCall, Rocket, ShoppingBag, StickyNote, UserRoundCog } from "lucide-react";
import { ago } from "@/lib/api";
import type { FeedEvent } from "@/lib/types";

const ICON: Record<FeedEvent["kind"], typeof PhoneCall> = {
  call: PhoneCall, whatsapp: MessageCircle, note: StickyNote, status: ClipboardList, assign: UserRoundCog,
  order: ShoppingBag, verified: BadgeCheck, signed: FileSignature, live: Rocket, paid: CircleDollarSign,
  message: Megaphone, handoff: Hand, quoted: ClipboardList,
};
const TONE: Partial<Record<FeedEvent["kind"], string>> = { handoff: "bg-brand text-white", order: "bg-ok text-white", live: "bg-ok text-white", paid: "bg-ok text-white" };

/** The team timeline: who did what, newest first. */
export function Feed({ events }: { events: FeedEvent[] }) {
  return (
    <ol className="grid gap-1">
      {events.map((e, i) => {
        const Icon = ICON[e.kind];
        const body = (
          <div className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-paper">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${TONE[e.kind] ?? "bg-paper text-ink-soft"}`}><Icon size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px]"><span className="font-bold">{e.who}</span> {e.title}</div>
              {e.detail && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{e.detail}</p>}
            </div>
            <span className="shrink-0 text-xs text-ink-soft">{ago(e.at)}</span>
          </div>
        );
        return <li key={`${e.at}${i}`}>{e.href ? <Link href={e.href}>{body}</Link> : body}</li>;
      })}
    </ol>
  );
}

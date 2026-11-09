import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { WhatsAppLogo } from "@/components/BrandIcons";
import type { PublicOrder } from "@/lib/order-view";

const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "918318401662").replace(/\D/g, "");
// Meta's test number replies only to numbers on its allowed list. Set NEXT_PUBLIC_WHATSAPP_TEST_MODE=0 once a real
// business number is connected and the note goes away.
const TEST_MODE = process.env.NEXT_PUBLIC_WHATSAPP_TEST_MODE !== "0";

/**
 * WhatsApp lets a business message someone only after they have written to it. One "hi" from the owner links this
 * order to their chat, and every update after that reaches them there.
 */
export function WhatsAppLink({ order }: { order: PublicOrder }) {
  if (order.whatsappLinked)
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-wa/10 px-4 py-3 text-sm font-semibold text-wa">
        <CheckCircle2 size={18} /> Updates are coming to your WhatsApp
      </p>
    );
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-wa/30 bg-wa/5 p-4">
      <WhatsAppLogo className="h-9 w-9 shrink-0" />
      <div className="min-w-48 flex-1">
        <div className="font-bold">Get updates on WhatsApp</div>
        <div className="text-sm text-ink-soft">Say hi once and we&apos;ll message you at every step: technician, installation, go-live and your bill.</div>
      </div>
      <a
        href={`https://wa.me/${NUMBER}?text=${encodeURIComponent(`Hi! Please send me updates for my order ${order.id}`)}`}
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-full bg-[#25D366] px-4 py-2.5 text-center font-extrabold text-white hover:brightness-95 sm:w-auto"
      >
        Say hi on WhatsApp
      </a>
      {TEST_MODE && (
        <p className="basis-full text-xs text-ink-soft">
          Our WhatsApp is in Meta&apos;s test mode for now and replies only to registered numbers. No reply? <Link href="/account" className="font-semibold underline">Get updates on Telegram</Link> instead.
        </p>
      )}
    </div>
  );
}

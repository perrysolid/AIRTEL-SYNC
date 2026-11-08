import { CheckCircle2 } from "lucide-react";
import { WhatsAppLogo } from "@/components/BrandIcons";
import type { PublicOrder } from "@/lib/order-view";

const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "15551369092").replace(/\D/g, "");

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
      <div className="min-w-0 flex-1">
        <div className="font-bold">Get updates on WhatsApp</div>
        <div className="text-sm text-ink-soft">Say hi once and we&apos;ll message you at every step: technician, installation, go-live and your bill.</div>
      </div>
      <a
        href={`https://wa.me/${NUMBER}?text=${encodeURIComponent(`Hi! Please send me updates for my order ${order.id}`)}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-[#25D366] px-4 py-2.5 font-extrabold text-white hover:brightness-95"
      >
        Say hi on WhatsApp
      </a>
    </div>
  );
}

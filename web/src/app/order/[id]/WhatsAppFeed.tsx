import { WhatsAppLogo } from "@/components/BrandIcons";
import type { PublicOrder } from "@/lib/order-view";

const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "15551369092").replace(/\D/g, "");

/**
 * WhatsApp lets a business message someone freely only after they have written to it. One message from the owner
 * links this order to their chat, and every update after that reaches them there.
 */
export function WhatsAppLink({ order }: { order: PublicOrder }) {
  return (
    <a
      href={`https://wa.me/${NUMBER}?text=${encodeURIComponent(`STATUS ${order.id}`)}`}
      target="_blank"
      rel="noreferrer"
      className="mt-10 flex items-center gap-3 rounded-2xl border border-rule bg-sheet p-4 hover:bg-paper"
    >
      <WhatsAppLogo className="h-8 w-8 shrink-0" />
      <span>
        <span className="block font-bold">Get every update on WhatsApp</span>
        <span className="block text-sm text-ink-soft">Send us one message and we&apos;ll tell you at each step.</span>
      </span>
    </a>
  );
}

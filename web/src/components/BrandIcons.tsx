/** WhatsApp and Telegram marks in their own colours, for "chat with us" buttons. Drawn at 24×24. */
export function WhatsAppLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#25D366" d="M12 1.6A10.4 10.4 0 0 0 3 17.2L1.6 22.4l5.3-1.4A10.4 10.4 0 1 0 12 1.6z" />
      <path fill="#fff" d="M12 3.4a8.6 8.6 0 0 0-7.3 13.2l.2.3-.9 3.2 3.3-.9.3.2A8.6 8.6 0 1 0 12 3.4zm0 1.5a7.1 7.1 0 1 1-3.6 13.2l-.5-.3-1.6.4.4-1.5-.3-.5A7.1 7.1 0 0 1 12 4.9z" />
      <path fill="#fff" d="M9.2 7.4c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4.3-.5c.1-.2 0-.3 0-.5l-.8-1.8z" />
    </svg>
  );
}

export function TelegramLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10.4" fill="#229ED9" />
      <path fill="#fff" d="M5.6 11.7l10.9-4.2c.5-.2.9.1.8.9l-1.9 8.8c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1l-6.6 4.1-2.8-.9c-.6-.2-.6-.6.2-.9z" />
    </svg>
  );
}

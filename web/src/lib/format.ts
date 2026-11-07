/** Client-safe formatting helpers (no server imports). */
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const dateIN = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

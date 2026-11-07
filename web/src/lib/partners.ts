/** Synthetic partner pool used for smart escalation (tickets, hand-offs). One partner per big city, a default elsewhere. */
const PARTNERS: Record<string, string> = {
  Pune: "Pune TechServe", Mumbai: "Konkan Telecom Associates", Delhi: "Capital Net Solutions", Bengaluru: "Namma Connect",
  Chennai: "Marina Networks", Hyderabad: "Deccan Digital", Kolkata: "Hooghly Infocom", Ahmedabad: "Sabarmati Systems",
  Jaipur: "Pink City Telecom", Lucknow: "Awadh Digital", Kochi: "Malabar Net",
};

export function partnerFor(city?: string): string {
  return (city && PARTNERS[city]) || "Sunrise Digital Partners";
}

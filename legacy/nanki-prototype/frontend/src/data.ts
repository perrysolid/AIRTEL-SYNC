// Shared static content for the marketing pages. Prices on screen are always computed live by the API.
export const PERSONAS = [
  { id: 'kirana', e: '🛒', t: "Raju's Kirana", d: 'Pune · 3 staff · mobile hotspot', seg: 'micro',
    p: { business_type: 'Kirana store', city: 'Pune', employees: 3, sites: 1, has_gstin: false, current_internet: 'Mobile hotspot', spend: 1500, needs: ['payments', 'whatsapp'] } },
  { id: 'clinic', e: '🦷', t: 'Harmony Dental', d: 'Kochi · 15 staff · GSTIN', seg: 'prof',
    p: { business_type: 'Dental clinic', city: 'Kochi', employees: 15, sites: 1, has_gstin: true, current_internet: 'Home broadband', spend: 4200, needs: ['email', 'backup', 'security'] } },
  { id: 'chain', e: '🍽️', t: 'Spice Route Chain', d: 'Delhi · 8 outlets · 60 staff', seg: 'multi',
    p: { business_type: 'Restaurant chain', city: 'Delhi', employees: 60, sites: 8, has_gstin: true, current_internet: 'Mixed per site', spend: 24000, needs: ['cctv', 'uptime', 'payments'] } },
  { id: 'factory', e: '🏭', t: 'Nashik Auto Parts', d: 'Nashik · 80 staff · GSTIN', seg: 'mfg',
    p: { business_type: 'Auto-parts unit', city: 'Nashik', employees: 80, sites: 1, has_gstin: true, current_internet: 'Leased line', spend: 30000, needs: ['machines', 'security'] } },
]

export const SEGMENTS = [
  { key: 'micro', csv: 'Micro retail & services', icon: '🛒', name: 'Micro retail & services', who: 'Kirana, salon, pharmacy, bakery, boutique', share: '55% of the SMB base',
    pain: ['UPI and billing fail on a mobile hotspot', 'Very price-sensitive: ₹2,500/month is the ceiling', 'Most have no GSTIN, which locks them out of products today'],
    plan: ['5G AirFiber live in about 2 days, 6-month commitment', 'WhatsApp-first journey, no visit', 'GSTIN-free bundle plus a nudge to unlock more'], persona: 'kirana' },
  { key: 'prof', csv: 'Professional offices', icon: '🩺', name: 'Professional offices', who: 'Clinics, CA firms, coaching centres, law offices', share: '25% of the SMB base',
    pain: ['Home broadband and personal Gmail', 'Downtime and data security worry them', 'Highest activation today (11%): the easiest first win'],
    plan: ['Fibre + business SIMs + email + endpoint security', 'Backup and secure Wi-Fi as one-tap add-ons', 'CA channel: one accountant onboards many clients'], persona: 'clinic' },
  { key: 'multi', csv: 'Small multi-site businesses', icon: '🏪', name: 'Small multi-site businesses', who: 'Restaurant chains, 3–10 store retailers, gyms, pre-schools', share: '15% of the SMB base',
    pain: ['A different ISP at every site, no central IT', 'One site down means lost sales that day', 'Highest bundle value (about ₹31k/month)'],
    plan: ['One bill, failover at every site', 'Branch-in-a-Box clones a store setup in one tap', 'Partner-led installs, digital quote and KYC'], persona: 'chain' },
  { key: 'mfg', csv: 'Small manufacturers', icon: '🏭', name: 'Small manufacturers', who: 'Auto-parts, textile, plastics, packaging units', share: '5% of the SMB base',
    pain: ['Need dedicated bandwidth and uptime for ERP', 'Site surveys make the journey slow', 'Low price sensitivity, high lifetime value'],
    plan: ['Leased line with an SLA, managed firewall', 'IoT machine monitoring as an add-on', 'Assisted journey: digital discovery, KYC and tracking'], persona: 'factory' },
]

export const FAQ: { cat: string; q: string; a: string }[] = [
  { cat: 'Buying', q: 'How much will I pay every month?', a: 'You see one monthly price before you commit, including 18% GST. Every product shows its price per unit, and you can switch add-ons on or off and watch the total change. The longer you commit (12 or 24 months), the lower the rate.' },
  { cat: 'Buying', q: 'What if I don’t have a GSTIN?', a: 'You can still buy everything that does not need one: fibre, 5G AirFiber, business SIMs, email, backup, POS and more. Products such as WhatsApp Business API and leased lines need an active GSTIN. If you add one later, we unlock them instantly.' },
  { cat: 'Buying', q: 'Is there a lock-in?', a: 'Contract lengths are set per product: 1 month for SIMs, 6 months for 5G AirFiber, 12 months for most products, 24 months for a few. Your quote shows the exact term for each line.' },
  { cat: 'Buying', q: 'Do I need to meet a salesperson?', a: 'No. The advisor, quote, KYC and e-sign all happen on your phone. For dedicated links we book a short video call for the site survey, and a local partner can help on the ground if you want.' },
  { cat: 'KYC & privacy', q: 'Which documents do you need?', a: 'GST certificate, Udyam certificate (optional), the signatory’s ID and an address proof no older than 90 days. You can type your GSTIN and we fetch your details from the registry, or send photos on WhatsApp.' },
  { cat: 'KYC & privacy', q: 'What happens to my documents?', a: 'We ask your consent first, read only the fields each check needs, mask identifiers on screen and in logs, and delete uploaded documents 30 days after verification. You can withdraw consent or ask for erasure from your order page.' },
  { cat: 'KYC & privacy', q: 'Why was my KYC flagged?', a: 'We tell you exactly why: for example a cancelled GSTIN, a typo that fails the GSTIN check digit, a name mismatch between documents, or an old utility bill. Fix it and retry, or a partner can help on a short call.' },
  { cat: 'Installation', q: 'How long does installation take?', a: 'SIMs, email and cloud products are instant. 5G AirFiber takes about 2 days, fibre about 5, and leased lines 3–4 weeks. Before you pay, the Network Reality Check tells you what is possible at your pincode.' },
  { cat: 'Installation', q: 'Can I change my installation time?', a: 'Yes, from your order page or by replying RESCHEDULE on WhatsApp. You get two free reschedules.' },
  { cat: 'Support', q: 'What if my internet goes down?', a: 'SYNC spots the outage, raises a ticket automatically and routes it to the right technician or partner for your city. If you have Backup 4G/5G Failover, you stay online while we fix the main link.' },
  { cat: 'Support', q: 'How do I check if a message is a scam?', a: 'Paste it or upload a screenshot in Scam Shield, or forward it to us on WhatsApp. We explain the red flags and what to do. Remember that a screenshot is not proof of payment, so check your bank or UPI app.' },
  { cat: 'Support', q: 'Can I add another shop later?', a: 'Yes. Branch-in-a-Box copies your setup to the new address, reuses your verified KYC and only asks for the new address proof.' },
]

export const FIXES = [
  { reason: 'Price too high', fix: 'Transparent bundle price, 24-month rate, GSTIN-free starter, savings vs list price' },
  { reason: 'Quote too complex to understand', fix: 'One monthly price in plain language, in your language, with reasons for every line' },
  { reason: 'Quote took too long to arrive', fix: 'Instant quote from the advisor: minutes instead of 3–5 days' },
  { reason: 'Owner had no time for a visit', fix: 'No visit needed: chat, KYC and e-sign on the phone' },
  { reason: 'Missing GST or Udyam document', fix: 'Registry lookup by GSTIN, DigiLocker-style pull, WhatsApp photo upload with retake hints' },
  { reason: 'Document details did not match', fix: 'Cross-document checks that say exactly what differs, before you submit' },
  { reason: 'Authorised signatory not available', fix: 'Forwardable e-sign link and consent captured on the signatory’s own phone' },
  { reason: 'Installation delayed beyond 21 days', fix: 'Network Reality Check, 5G AirFiber fallback (2 days) and a self-serve slot scheduler' },
  { reason: 'Site not feasible for fibre', fix: 'Pincode check before payment with automatic wireless fallback' },
]

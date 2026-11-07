/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, MessageCircle, Sparkles, X } from 'lucide-react'
import { api, inr } from '../api'
import { selFromReco, useStore } from '../store'
import { tr } from '../i18n'
import { PERSONAS, FAQ } from '../data'
import { CountUp, PhoneDemo, Reveal, SectionHead } from '../components/Bits'

const NEEDS = [
  { to: '/advisor', t: 'n_buy', i: '🛒', c: 'ic-red', reset: true },
  { to: '/shield', t: 'n_shield', i: '🛡️', c: 'ic-amber', isNew: true },
  { to: '/network', t: 'n_net', i: '📡', c: 'ic-blue', isNew: true },
  { to: '/track', t: 'n_track', i: '📦', c: 'ic-green' },
  { to: '/track?tab=branch', t: 'n_branch', i: '🏪', c: 'ic-gray', isNew: true },
  { to: '/whatsapp', t: 'n_wa', i: '💬', c: 'ic-green' },
]
const TYPES = ['Kirana store', 'Salon', 'Pharmacy', 'Dental clinic', 'CA firm', 'Coaching centre', 'Restaurant chain', 'Auto-parts unit']
const CITIES = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Kochi', 'Nashik', 'Lucknow']
const SCAM_EG = 'Dear customer, your Airtel SIM will be blocked today. Update KYC immediately at http://airtel-kyc-update.xyz or call 9876543210'

function TryIt() {
  const [tab, setTab] = useState(0)
  const { setReco, setSel, setSession, reset, lang } = useStore()
  const nav = useNavigate()
  const [f, setF] = useState({ business_type: 'Kirana store', city: 'Pune', employees: 3, sites: 1, has_gstin: false })
  const [r, setR] = useState<any>(null)
  useEffect(() => {
    const t = setTimeout(() => api('/recommend', { ...f, current_internet: 'Mobile hotspot', spend: 0, needs: [] }).then(setR).catch(() => {}), 200)
    return () => clearTimeout(t)
  }, [f])
  async function open() {
    reset(); const p = { ...f, current_internet: 'Mobile hotspot', spend: 0, needs: [] as string[] }
    const x = await api('/recommend', p); setSession({ id: null, slots: p, needs: [], lang }); setReco(x); setSel(selFromReco(x)); nav('/quote')
  }
  const [pin, setPin] = useState('411016'); const [net, setNet] = useState<any>(null)
  const [msg, setMsg] = useState(SCAM_EG); const [sc, setSc] = useState<any>(null)
  return (
    <div className="card tryit" id="try">
      <div className="row between wrap"><div><span className="eyebrow">Try it now · no sign-up</span><h3 style={{ marginTop: 4 }}>Three answers in ten seconds</h3></div>
        <div className="seg">{['💰 What will it cost?', '📡 Is my area covered?', '🛡️ Is this message a scam?'].map((t, i) => <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>)}</div></div>
      {tab === 0 && <div className="tryit-body">
        <div className="tryit-form">
          <label className="f" htmlFor="tt">My business</label>
          <select id="tt" className="input" value={f.business_type} onChange={e => setF({ ...f, business_type: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <label className="f mt" htmlFor="tc">City</label>
          <select id="tc" className="input" value={f.city} onChange={e => setF({ ...f, city: e.target.value })}>{CITIES.map(t => <option key={t}>{t}</option>)}</select>
          <label className="f mt" htmlFor="te">People: {f.employees}</label>
          <input id="te" className="range" type="range" min={1} max={120} value={f.employees} onChange={e => setF({ ...f, employees: +e.target.value })} />
          <label className="f" htmlFor="ts">Branches: {f.sites}</label>
          <input id="ts" className="range" type="range" min={1} max={12} value={f.sites} onChange={e => setF({ ...f, sites: +e.target.value })} />
          <label className="row" style={{ marginTop: 10, fontWeight: 600 }}><input type="checkbox" checked={f.has_gstin} onChange={e => setF({ ...f, has_gstin: e.target.checked })} /> I have a GSTIN</label>
        </div>
        <div className="tryit-out">{r ? <>
          <span className="badge green">{r.segment_name}</span>
          <div className="price big" style={{ marginTop: 6 }}>{inr(r.quote.monthly_total)}<span className="muted sm" style={{ fontWeight: 600 }}> /month incl. GST</span></div>
          <div className="muted sm">{r.quote.lines.length} services · one bill · setup {inr(r.quote.setup_total)} · live in ~{r.quote.install_days + 1} days</div>
          <div className="mt">{r.quote.lines.slice(0, 5).map((l: any) => <div key={l.product_id} className="totalbar sm"><span>{l.name} × {l.qty}</span><span>{inr(l.monthly)}</span></div>)}</div>
          {!f.has_gstin && r.gstin_unlock_count > 0 && <div className="banner warn mt"><span>🔒</span><span>A GSTIN unlocks {r.gstin_unlock_count} more products.</span></div>}
          <button className="btn primary mt" onClick={open}>Customise this bundle <ArrowRight size={16} /></button>
        </> : <div className="skel" style={{ height: 220 }} />}</div>
      </div>}
      {tab === 1 && <div className="tryit-body"><div className="tryit-form">
        <label className="f" htmlFor="tp">Your shop's pincode</label>
        <div className="row"><input id="tp" className="input mono" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          <button className="btn dark" disabled={pin.length !== 6} onClick={async () => setNet(await api('/network/check', { pincode: pin, city: 'Pune' }))}>Check</button></div>
        <p className="muted sm">Try 411016 (fibre not available) or 411001 (fibre available).</p></div>
        <div className="tryit-out">{net?.ok ? <>
          <div className={'banner ' + (net.recommended === 'fibre' ? 'ok' : 'info')}><span>{net.recommended === 'fibre' ? '✅' : '📡'}</span><b>{net.message}</b></div>
          {net.options.slice(0, 2).map((o: any) => <div key={o.key} className="totalbar"><span>{o.available ? '✅' : '❌'} {o.name}</span><b>{o.available ? `~${o.install_days} days` : 'n/a'}</b></div>)}
          <Link to="/network" className="btn ghost sm mt">Full coverage report</Link></> : <p className="muted">Enter a pincode to see what can be installed before you pay.</p>}</div></div>}
      {tab === 2 && <div className="tryit-body"><div className="tryit-form">
        <label className="f" htmlFor="tm">Paste a suspicious message</label>
        <textarea id="tm" className="input" rows={5} value={msg} onChange={e => setMsg(e.target.value)} />
        <button className="btn dark mt" onClick={async () => setSc(await api('/scam/check', { text: msg, lang: lang === 'hi' ? 'hi' : 'en' }))}>Check it</button></div>
        <div className="tryit-out">{sc ? <>
          <div className={'verdict-card ' + sc.verdict} style={{ padding: 16 }}><div style={{ flex: 1 }}><h3>{sc.label}</h3><div className="muted sm">{sc.advice}</div><div className="meter"><i style={{ width: sc.score + '%', background: sc.verdict === 'scam' ? '#e11d2e' : sc.verdict === 'suspicious' ? '#d98a05' : '#0f9d6b' }} /></div></div></div>
          {sc.reasons.slice(0, 2).map((x: any, i: number) => <div key={i} className="reason"><span className={'dotk dot-' + x.severity} /><span>{x.text}</span></div>)}
          <Link to="/shield" className="btn ghost sm mt">See the full report</Link></> : <p className="muted">We'll show a verdict, why, and what to do next.</p>}</div></div>}
    </div>
  )
}

const FEATURES = [
  { i: '🤖', t: 'AI Business Advisor', d: 'Six questions, in 10 languages, by text or voice. A bundle built from your business, with the reason for every line.', to: '/advisor' },
  { i: '⚡', t: 'Smart KYC in minutes', d: 'GSTIN lookup, document OCR, cross-checks and e-sign. It tells you exactly what to fix, not just “failed”.', to: '/kyc' },
  { i: '🛡️', t: 'Scam Shield', d: 'Forward a suspicious message, link or payment screenshot. Get a verdict, the red flags and the next step.', to: '/shield', n: true },
  { i: '📡', t: 'Network Reality Check', d: 'Know what can be installed at your pincode before paying. Fibre unavailable? We switch you to 5G AirFiber.', to: '/network', n: true },
  { i: '💓', t: 'Health & Continuity', d: 'Live service status, automatic tickets, SLA clock and a backup link that keeps your billing running.', to: '/track?tab=health', n: true },
  { i: '🏪', t: 'Branch-in-a-Box', d: 'Opening a second shop? Copy your setup, reuse your KYC and book the install in one tap.', to: '/track?tab=branch', n: true },
  { i: '💬', t: 'WhatsApp, end to end', d: 'Buy, upload documents, book an install, fix problems and check scams without leaving the chat.', to: '/whatsapp', n: true },
  { i: '🤝', t: 'Partner co-pilot', d: 'Hand-offs with full context, a ranked call list and lead rescue. Partners close, the platform does the paperwork.', to: '/partners' },
]

const COMPARE: [string, string, string][] = [
  ['Needs discovery', 'Sales visit; pitches what is on target', 'Advisor chat in your language, 2 minutes'],
  ['Quote', '3–5 days, PDF with product codes', 'Instant, one price in plain words'],
  ['KYC & paperwork', 'Physical copies, email chasing', 'Registry lookup, OCR, WhatsApp photos'],
  ['Installation', '10–14 days, 3–4 follow-up calls', 'Pincode check, self-serve slot, live tracker'],
  ['After activation', 'Each product billed and supported separately', 'One bill, one support number, proactive alerts'],
]

export default function Landing() {
  const { lang, setReco, setSel, setSession, reset } = useStore()
  const nav = useNavigate()
  const [prices, setPrices] = useState<Record<string, any>>({})
  const [open, setOpen] = useState<number | null>(0)
  useEffect(() => { PERSONAS.forEach(p => api('/recommend', p.p).then(r => setPrices(x => ({ ...x, [p.id]: r }))).catch(() => {})) }, [])
  const quick = async (p: (typeof PERSONAS)[number]['p']) => {
    reset(); const r = await api('/recommend', p)
    setSession({ id: null, slots: { ...p }, needs: p.needs, lang }); setReco(r); setSel(selFromReco(r)); nav('/quote')
  }
  return (
    <main className="page home">
      <section className="hero2">
        <div className="mesh" aria-hidden />
        <div className="hero2-l">
          <Link to="/shield" className="pill-new"><Sparkles size={14} /> New: Scam Shield &amp; Network Reality Check <ArrowRight size={14} /></Link>
          <h1>Go digital <em>in one sitting.</em></h1>
          <p className="lead">Internet, SIMs, WhatsApp, cloud and security for your business, with one clear monthly price. Tell Sync about your shop in your own language, verify KYC in minutes and track your install. No sales visit, no status calls.</p>
          <div className="row wrap">
            <button className="btn primary lg" onClick={() => { reset(); nav('/advisor') }}>{tr(lang, 'n_buy')} <ArrowRight size={18} /></button>
            <a href="#try" className="btn glass lg">Try it in 10 seconds</a>
            <Link to="/whatsapp" className="btn glass lg"><MessageCircle size={18} /> WhatsApp</Link>
          </div>
          <div className="trust">{['10 Indian languages', 'DPDP-ready consent', 'Live in ~2 days', 'One bill'].map(t => <span key={t}><Check size={14} /> {t}</span>)}</div>
        </div>
        <div className="hero2-r">
          <PhoneDemo />
          <div className="float f1">🛡️ Scam blocked</div><div className="float f2">📡 5G ready in 2 days</div><div className="float f3">✅ KYC verified in 90s</div>
        </div>
      </section>

      <Reveal><TryIt /></Reveal>

      <Reveal><h2 className="sec-title mt2" style={{ marginBottom: 0 }}>{tr(lang, 'need_title')}</h2>
        <div className="need-grid">{NEEDS.map(n => (
          <Link key={n.to} to={n.to} onClick={n.reset ? () => reset() : undefined} className="card need">
            <div className={'ico ' + n.c}>{n.i}</div><b>{tr(lang, n.t)}</b><span className="d">{tr(lang, n.t + '_d')}</span>{n.isNew && <span className="badge red new">New</span>}
          </Link>))}</div></Reveal>

      <Reveal className="statband">
        <div><b><CountUp to={17.6} decimals={1} /></b><span>days to activate today</span><i>→ ~3 days with SYNC</i></div>
        <div><b><CountUp to={3} /></b><span>status calls per customer</span><i>→ 0 with live tracker</i></div>
        <div><b>₹<CountUp to={15000} /></b><span>to acquire one customer</span><i>→ under ₹3,000 digital</i></div>
        <div><b><CountUp to={7.4} decimals={1} suffix="%" /></b><span>of leads activate</span><i>→ 15%+ target</i></div>
      </Reveal>
      <p className="muted sm center" style={{ marginTop: 8 }}>Baselines from the Apr–Jun 2026 lead file (5,000 synthetic leads). Targets are our proposal.</p>

      <Reveal><SectionHead eyebrow="How it works" title="Four steps. One sitting." sub="Every step replaces a slow, paper-heavy handoff in today's field-sales journey." />
        <div className="journey-cards">
          {[['1', '🤖', 'Tell Sync', 'Chat or speak in your language. Sync builds your bundle and explains each line.', '/advisor'], ['2', '💰', 'See one price', 'A transparent monthly price. Toggle add-ons, check your pincode, pick 12 or 24 months.', '/quote'],
            ['3', '🪪', 'Verify KYC', 'Type your GSTIN or send photos. Registry checks and clear fixes in minutes.', '/kyc'], ['4', '📦', 'Track & get help', 'Live status, a slot you choose, WhatsApp updates and automatic support.', '/track']].map(([n, e, t, d, to]) => (
            <Link to={to} key={n} className="card jc"><div className="jn">{n}</div><div style={{ fontSize: 30 }}>{e}</div><h4>{t}</h4><p className="muted sm">{d}</p></Link>))}
        </div></Reveal>

      <Reveal><SectionHead eyebrow="Beyond the sale" title="Not just a purchase flow. A companion for your business." sub="SYNC stays with you after activation: it protects, monitors and helps you grow." />
        <div className="feat-grid">{FEATURES.map(f => (
          <Link key={f.t} to={f.to} className="card feat"><div className="row between"><span style={{ fontSize: 30 }}>{f.i}</span>{f.n && <span className="badge red">New</span>}</div><h4>{f.t}</h4><p className="muted sm">{f.d}</p><span className="more">Explore <ArrowRight size={14} /></span></Link>))}</div></Reveal>

      <Reveal><SectionHead eyebrow="Built for businesses like yours" title="Real bundles, priced live" sub="These prices are computed right now from the product catalogue and eligibility rules, not a brochure." />
        <div className="persona-grid">{PERSONAS.map(p => { const r = prices[p.id]; return (
          <button key={p.id} className="card persona" onClick={() => quick(p.p)}>
            <div className="row between"><span style={{ fontSize: 30 }}>{p.e}</span><span className="badge gray">{r?.segment_name || '…'}</span></div>
            <h4>{p.t}</h4><div className="muted sm">{p.d}</div>
            <div className="price" style={{ fontSize: 30, marginTop: 10 }}>{r ? inr(r.quote.monthly_total) : '…'}<span className="muted sm" style={{ fontWeight: 600 }}>/mo</span></div>
            <div className="muted sm">{r ? `${r.quote.lines.length} services · one bill` : ''}</div><span className="more">Open this quote <ArrowRight size={14} /></span>
          </button>) })}</div>
        <div className="center mt"><Link to="/solutions" className="btn ghost">See all solutions</Link></div></Reveal>

      <Reveal><SectionHead eyebrow="Before and after" title="Same products. A very different journey." />
        <div className="card compare"><div className="cmp-h"><span /><b className="bad">Today</b><b className="good">With SYNC</b></div>
          {COMPARE.map(([a, b, c]) => <div className="cmp-r" key={a}><b>{a}</b><span className="bad"><X size={14} /> {b}</span><span className="good"><Check size={14} /> {c}</span></div>)}</div></Reveal>

      <Reveal><div className="band">
        <div><span className="eyebrow" style={{ color: '#ff8a95' }}>For sales teams &amp; partners</span><h2 style={{ color: '#fff', margin: '6px 0 8px' }}>Digital that adds to your field force</h2>
          <p style={{ color: '#c8ccd8', maxWidth: 540 }}>Hard leads arrive with full context, easy ones close themselves, and a model tells you who to call first. Partners complete onboarding on the customer's own phone, with the customer's consent.</p></div>
        <div className="row wrap"><Link to="/partners" className="btn primary">Partner programme</Link><Link to="/ops" className="btn glass">Open the console</Link></div></div></Reveal>

      <Reveal><SectionHead eyebrow="Questions" title="Quick answers" />
        <div className="faq">{FAQ.slice(0, 6).map((f, i) => (
          <div key={f.q} className={'faq-i ' + (open === i ? 'open' : '')}><button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}><span>{f.q}</span><span className="pm">{open === i ? '–' : '+'}</span></button>{open === i && <p>{f.a}</p>}</div>))}</div>
        <div className="center mt"><Link to="/help" className="btn ghost">Visit the help centre</Link></div></Reveal>

      <Reveal><div className="cta-final"><h2>Ready to go digital?</h2><p>It takes about as long as making a cup of tea.</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}><button className="btn primary lg" onClick={() => { reset(); nav('/advisor') }}>Start with Sync <ArrowRight size={18} /></button><Link to="/whatsapp" className="btn glass lg">Or chat on WhatsApp</Link></div></div></Reveal>
    </main>
  )
}

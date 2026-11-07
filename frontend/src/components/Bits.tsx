import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: 0.5, delay }}>{children}</motion.div>
}

export function CountUp({ to, decimals = 0, prefix = '', suffix = '' }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => { if (inView) { const c = animate(0, to, { duration: 1.4, ease: 'easeOut', onUpdate: x => setV(x) }); return () => c.stop() } }, [inView, to])
  return <span ref={ref}>{prefix}{v.toFixed(decimals)}{suffix}</span>
}

export function SectionHead({ eyebrow, title, sub, center }: { eyebrow?: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? 'center' : ''} style={{ maxWidth: 760, margin: center ? '0 auto' : 0 }}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="sec-title">{title}</h2>
      {sub && <p className="muted sec-sub">{sub}</p>}
    </div>
  )
}

type Line = { from: 'in' | 'out'; text: string }
const SCRIPT: Line[] = [
  { from: 'out', text: 'Hi' },
  { from: 'in', text: 'Namaste! I’m *Sync* from Accel Business. What would you like to do?' },
  { from: 'out', text: 'Kirana store, Pune, 3 staff. UPI keeps failing on hotspot' },
  { from: 'in', text: 'Got it. Here’s your bundle:\n• 5G AirFiber ×1  ₹999\n• Business SIM ×2  ₹698\n• Cloud POS ×1  ₹699\n*₹2,742/month incl. GST*' },
  { from: 'out', text: '📷 GST certificate' },
  { from: 'in', text: '✅ Got your GST certificate. Send your ID and address proof next.' },
  { from: 'out', text: 'Your SIM will be blocked! Update KYC http://airtel-kyc.xyz' },
  { from: 'in', text: '🚨 *Likely a scam* (risk 100/100)\n• The link imitates Airtel but is not its official site.\nDo not click. Report on Chakshu.' },
]
const fmt = (t: string) => t.split(/(\*[^*]+\*)/g).map((p, i) => (p.startsWith('*') && p.endsWith('*') ? <b key={i}>{p.slice(1, -1)}</b> : <span key={i}>{p}</span>))

export function PhoneDemo() {
  const [n, setN] = useState(1)
  const [typing, setTyping] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (n >= SCRIPT.length) { t = setTimeout(() => setN(1), 4200); return () => clearTimeout(t) }
    const next = SCRIPT[n]
    setTyping(next.from === 'in')
    t = setTimeout(() => { setTyping(false); setN(n + 1) }, next.from === 'in' ? 1500 : 900)
    return () => clearTimeout(t)
  }, [n])
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }) }, [n, typing])
  return (
    <div className="phone sm" aria-label="Live demo of the WhatsApp assistant"><div className="phone-in">
      <div className="wa-head"><div className="avatar" style={{ width: 34, height: 34 }}>A</div><div><b>Accel Business</b><div style={{ fontSize: 11, opacity: .8 }}>Verified · online</div></div></div>
      <div className="wa-body" ref={box}>{SCRIPT.slice(0, n).map((m, i) => <div key={i} className={'wa-b ' + m.from}>{fmt(m.text)}</div>)}
        {typing && <div className="wa-b in typing"><span /><span /><span /></div>}</div>
      <div className="wa-in"><input disabled placeholder="Message" aria-hidden /><div className="wa-send" aria-hidden>➤</div></div>
    </div></div>
  )
}

export function Footer() {
  const col = (title: string, links: [string, string][]) => (
    <div><b>{title}</b>{links.map(([l, to]) => <Link key={l} to={to}>{l}</Link>)}</div>
  )
  return (
    <footer className="footer"><div className="footer-in">
      <div className="foot-brand"><div className="brand"><img src="/favicon.svg" alt="" />Accel SYNC</div>
        <p>The digital operating companion for India’s small businesses: buy, verify, activate, protect and grow in one sitting.</p>
        <span className="badge gray">Prototype · all data is synthetic</span></div>
      {col('Explore', [['Solutions', '/solutions'], ['Products', '/products'], ['How it works', '/how-it-works'], ['Get a bundle', '/advisor']])}
      {col('Tools', [['Scam Shield', '/shield'], ['Network check', '/network'], ['WhatsApp assistant', '/whatsapp'], ['Track my service', '/track']])}
      {col('Company', [['Partners', '/partners'], ['Partner console', '/ops'], ['Privacy & security', '/privacy'], ['Help centre', '/help']])}
    </div><div className="footer-bot">Built for the YTL Hackathon 2026 · Accel Telecom is a fictional operator · Not real company data</div></footer>
  )
}

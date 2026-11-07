import { NavLink, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Home, MessageCircle, ShieldAlert, ShoppingBag, LifeBuoy, Headset, Radio, Check, Menu, X } from 'lucide-react'
import { useStore } from './store'
import { LANGS } from './api'
import { tr } from './i18n'
import { Footer } from './components/Bits'
import Landing from './pages/Landing'
import Advisor from './pages/Advisor'
import Quote from './pages/Quote'
import Kyc from './pages/Kyc'
import Track from './pages/Track'
import WhatsApp from './pages/WhatsApp'
import Ops from './pages/Ops'
import Shield from './pages/Shield'
import Network from './pages/Network'
import Solutions from './pages/Solutions'
import Products from './pages/Products'
import HowItWorks from './pages/HowItWorks'
import Privacy from './pages/Privacy'
import Partners from './pages/Partners'
import Help from './pages/Help'

const JOURNEY = [{ to: '/advisor', k: 's1' }, { to: '/quote', k: 's2' }, { to: '/kyc', k: 's3' }, { to: '/track', k: 's4' }]

function Journey() {
  const { pathname } = useLocation()
  const { lang, reco, orderId } = useStore()
  const idx = JOURNEY.findIndex(j => pathname.startsWith(j.to))
  if (idx < 0) return null
  const reach = [true, !!reco, !!reco, !!orderId]
  return (
    <nav className="journey" aria-label="Your journey"><ol>
      {JOURNEY.map((j, i) => {
        const on = i === idx, dn = i < idx
        const inner = <><span className="n">{dn ? <Check size={14} /> : i + 1}</span><span className="lbl">{tr(lang, j.k)}</span></>
        return <li key={j.to} className={on ? 'on' : dn ? 'done' : ''}>{reach[i] ? <NavLink to={i === 3 && orderId ? `/track/${orderId}` : j.to}>{inner}</NavLink> : <span className="jb">{inner}</span>}</li>
      })}
    </ol></nav>
  )
}

function HelpButton() {
  const [open, setOpen] = useState(false)
  const { lang } = useStore()
  const nav = useNavigate()
  const go = (to: string) => { setOpen(false); nav(to) }
  return (<>
    {open && <div className="sheet" role="dialog" aria-label="Help">
      <b>{tr(lang, 'help_title')}</b>
      <div style={{ marginTop: 8 }}>
        <button className="row" onClick={() => go('/advisor?human=1')}><Headset size={20} color="#e11d2e" />{tr(lang, 'help_person')}</button>
        <button className="row" onClick={() => go('/whatsapp')}><MessageCircle size={20} color="#128c7e" />{tr(lang, 'help_wa')}</button>
        <button className="row" onClick={() => go('/shield')}><ShieldAlert size={20} color="#d98a05" />{tr(lang, 'help_shield')}</button>
        <button className="row" onClick={() => go('/help')}><LifeBuoy size={20} color="#2563eb" />Help centre</button>
      </div>
    </div>}
    <button className="fab" aria-label="Help" onClick={() => setOpen(!open)}><LifeBuoy size={24} /></button>
  </>)
}

const MENU: [string, string, string][] = [
  ['/solutions', '🏪', 'Solutions'], ['/products', '📦', 'Products'], ['/how-it-works', '🧭', 'How it works'], ['/whatsapp', '💬', 'WhatsApp assistant'],
  ['/network', '📡', 'Network check'], ['/partners', '🤝', 'Partners'], ['/ops', '📊', 'Partner console'], ['/privacy', '🔒', 'Privacy & security'], ['/help', '❓', 'Help centre'],
]

export default function App() {
  const { orderId, lang, setLang } = useStore()
  const loc = useLocation()
  const nav = useNavigate()
  const [more, setMore] = useState(false)
  useEffect(() => { window.scrollTo(0, 0); setMore(false) }, [loc.pathname])
  const trackTo = orderId ? `/track/${orderId}` : '/track'
  const link = (to: string, label: string, icon?: React.ReactNode) => <NavLink to={to} className={({ isActive }) => (isActive ? 'on' : '')}>{icon}{label}</NavLink>
  return (
    <div className="shell">
      <header className="topbar"><div className="topbar-in">
        <Link to="/" className="brand"><img src="/favicon.svg" alt="" /><div>Accel SYNC<small>Business · one sitting</small></div></Link>
        <nav className="nav" aria-label="Primary">
          {link('/solutions', 'Solutions')}{link('/products', 'Products')}{link('/how-it-works', 'How it works')}{link('/shield', tr(lang, 'shield'))}{link(trackTo, tr(lang, 'track'))}{link('/partners', 'Partners')}
        </nav>
        <select className="langsel" aria-label="Language" value={lang} onChange={e => setLang(e.target.value)} style={{ marginLeft: 'auto' }}>
          {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn primary sm navcta" onClick={() => nav('/advisor')}>Get started</button>
      </div></header>
      <Journey />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/advisor" element={<Advisor />} />
        <Route path="/quote" element={<Quote />} />
        <Route path="/kyc" element={<Kyc />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:id" element={<Track />} />
        <Route path="/whatsapp" element={<WhatsApp />} />
        <Route path="/ops" element={<Ops />} />
        <Route path="/shield" element={<Shield />} />
        <Route path="/network" element={<Network />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/products" element={<Products />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<main className="page narrow center"><h2>Page not found</h2><p className="muted">That page doesn’t exist.</p><Link to="/" className="btn primary mt">Go home</Link></main>} />
      </Routes>
      <Footer />
      <HelpButton />
      {more && <><div className="scrim" onClick={() => setMore(false)} /><div className="menu-sheet" role="dialog" aria-label="More">
        <div className="row between"><b>Explore</b><button aria-label="Close" onClick={() => setMore(false)}><X /></button></div>
        {MENU.map(([to, e, l]) => <Link key={to} to={to}><span>{e}</span>{l}</Link>)}</div></>}
      <nav className="bottomnav" aria-label="Main">
        {link('/', tr(lang, 'home'), <Home size={20} />)}{link('/advisor', tr(lang, 'buy'), <ShoppingBag size={20} />)}
        {link('/shield', tr(lang, 'shield'), <ShieldAlert size={20} />)}{link(trackTo, tr(lang, 'track'), <Radio size={20} />)}
        <button className="bn-more" onClick={() => setMore(true)} aria-label="More"><Menu size={20} /><span>More</span></button>
      </nav>
    </div>
  )
}

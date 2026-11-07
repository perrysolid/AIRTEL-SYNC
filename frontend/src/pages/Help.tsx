import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Search, ShieldAlert, Headset } from 'lucide-react'
import { FAQ } from '../data'

const CATS = ['All', ...Array.from(new Set(FAQ.map(f => f.cat)))]

export default function Help() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const rows = useMemo(() => FAQ.filter(f => (cat === 'All' || f.cat === cat) && (!q || (f.q + f.a).toLowerCase().includes(q.toLowerCase()))), [q, cat])
  return (
    <main className="page" style={{ maxWidth: 940 }}>
      <section className="phero"><span className="eyebrow" style={{ color: '#ff8a95' }}>Help centre</span><h1>How can we help?</h1><p>Search the answers below, or talk to us in the way that suits you.</p></section>

      <div className="grid3 mt">
        <Link to="/whatsapp" className="card pcard"><MessageCircle color="#128c7e" /><h4>Chat on WhatsApp</h4><p className="muted sm" style={{ margin: 0 }}>Status, rescheduling and troubleshooting in one chat.</p></Link>
        <Link to="/advisor?human=1" className="card pcard"><Headset color="#e11d2e" /><h4>Talk to a person</h4><p className="muted sm" style={{ margin: 0 }}>A local partner calls back within 2 working hours.</p></Link>
        <Link to="/shield" className="card pcard"><ShieldAlert color="#d98a05" /><h4>Check a suspicious message</h4><p className="muted sm" style={{ margin: 0 }}>Paste it or upload a screenshot.</p></Link>
      </div>

      <div className="card pad mt">
        <div className="search"><Search size={18} /><input aria-label="Search help" className="input" placeholder="Search: GSTIN, install time, outage…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="row wrap mt" style={{ marginTop: 12 }}>{CATS.map(c => <button key={c} className={'chip ' + (cat === c ? 'on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
      </div>

      <div className="faq" style={{ maxWidth: 'none' }}>
        {rows.map(f => (
          <div key={f.q} className={'faq-i ' + (open === f.q ? 'open' : '')}><button onClick={() => setOpen(open === f.q ? null : f.q)} aria-expanded={open === f.q}><span><span className="tag" style={{ marginRight: 10 }}>{f.cat}</span>{f.q}</span><span className="pm">{open === f.q ? '–' : '+'}</span></button>{open === f.q && <p>{f.a}</p>}</div>))}
        {rows.length === 0 && <div className="card pad center muted">No answers found. Try WhatsApp or talk to a person above.</div>}
      </div>
    </main>
  )
}

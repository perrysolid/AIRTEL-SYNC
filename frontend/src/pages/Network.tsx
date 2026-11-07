/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { api } from '../api'

export function Signal({ q }: { q: number }) {
  const bars = Math.round(q / 25)
  return <span className="signal" aria-label={`Signal ${q}%`}>{[8, 12, 16, 22].map((h, i) => <i key={i} className={i < bars ? '' : 'off'} style={{ height: h }} />)}</span>
}

export function NetworkResult({ r }: { r: any }) {
  return (<div>
    <div className={'banner ' + (r.recommended === 'fibre' ? 'ok' : r.recommended === 'airfiber' ? 'info' : 'warn')}>
      <span style={{ fontSize: 22 }}>{r.recommended === 'fibre' ? '✅' : r.recommended === 'airfiber' ? '📡' : '🧭'}</span><div><b>{r.message}</b></div></div>
    {r.options.map((o: any) => (
      <div key={o.key} className={'opt ' + (o.key === r.recommended ? 'rec' : '') + (o.available ? '' : ' no')}>
        <div style={{ width: 28 }}>{o.available ? <Check color="#0f9d6b" /> : <X color="#6b6f7b" />}</div>
        <div style={{ flex: 1 }}><b>{o.name}</b> {o.key === r.recommended && <span className="badge green">Recommended</span>}
          <div className="muted sm">{o.note}</div></div>
        <div style={{ textAlign: 'right' }}><b>{o.available ? `~${o.install_days} days` : 'Not available'}</b><div className="muted sm">{o.speed}</div>{o.signal && o.available && <Signal q={o.signal} />}</div>
      </div>))}
    <p className="muted sm">Coverage in this demo is simulated from the pincode; a live build would call Accel's serviceability API.</p>
  </div>)
}

export default function Network() {
  const [pin, setPin] = useState('')
  const [city, setCity] = useState('Pune')
  const [r, setR] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(p = pin, c = city) {
    setBusy(true); setErr('')
    try { const x = await api('/network/check', { pincode: p, city: c }); x.ok ? setR(x) : (setR(null), setErr(x.error)) } finally { setBusy(false) }
  }
  return (
    <main className="page narrow">
      <span className="eyebrow">Network Reality Check</span>
      <h1 style={{ fontSize: 'clamp(26px,4vw,38px)', margin: '6px 0 8px' }}>Will it actually work at my shop?</h1>
      <p className="muted">Check what can be installed at your address before you pay anything. No surprises, no cancelled installs.</p>
      <div className="card pad mt">
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}><label className="f" htmlFor="pin">Pincode</label><input id="pin" className="input mono" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="6 digits" onKeyDown={e => e.key === 'Enter' && go()} /></div>
          <div style={{ flex: 1, minWidth: 160 }}><label className="f" htmlFor="city">City</label>
            <select id="city" className="input" value={city} onChange={e => setCity(e.target.value)}>{['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kochi', 'Nashik', 'Nagpur', 'Indore', 'Surat', 'Patna'].map(c => <option key={c}>{c}</option>)}</select></div>
          <button className="btn primary" disabled={pin.length !== 6 || busy} onClick={() => go()}>{busy ? 'Checking…' : 'Check my area'}</button>
        </div>
        <div className="row wrap mt" style={{ marginTop: 12 }}><span className="muted sm">Try:</span>
          {[['411001', 'Pune'], ['411016', 'Pune'], ['682002', 'Kochi'], ['682001', 'Kochi']].map(([p, c]) => <button key={p} className="chip sm" onClick={() => { setPin(p); setCity(c); go(p, c) }}>{p} · {c}</button>)}</div>
        {err && <p style={{ color: 'var(--red)', fontWeight: 600 }}>{err}</p>}
      </div>
      {r && <div className="card pad mt"><NetworkResult r={r} /><Link to="/advisor" className="btn primary mt">Build my bundle for this address →</Link></div>}
    </main>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { api, inr } from '../api'
import { selFromReco, useStore } from '../store'
import { PERSONAS, SEGMENTS } from '../data'

export default function Solutions() {
  const { lang, reset, setReco, setSel, setSession } = useStore()
  const nav = useNavigate()
  const [an, setAn] = useState<any>(null)
  const [reco, setRec] = useState<Record<string, any>>({})
  useEffect(() => {
    api('/ops/analytics').then(setAn).catch(() => {})
    PERSONAS.forEach(p => api('/recommend', p.p).then(r => setRec(x => ({ ...x, [p.id]: r }))).catch(() => {}))
  }, [])
  const open = async (id: string) => {
    const p = PERSONAS.find(x => x.id === id)!
    reset(); const r = await api('/recommend', p.p); setSession({ id: null, slots: { ...p.p }, needs: p.p.needs, lang }); setReco(r); setSel(selFromReco(r)); nav('/quote')
  }
  return (
    <main className="page">
      <section className="phero"><span className="eyebrow" style={{ color: '#ff8a95' }}>Solutions</span>
        <h1>The right bundle for every kind of small business</h1>
        <p>Four segments, four very different needs. Each one gets a starting bundle, a price point and a journey that fits how they actually buy.</p></section>

      <div className="layout-side">
        <nav className="sidenav" aria-label="Segments">{SEGMENTS.map(s => <a key={s.key} href={'#' + s.key}>{s.icon} {s.name}</a>)}<Link to="/products" style={{ color: 'var(--red)' }}>Browse all 25 products →</Link></nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {SEGMENTS.map(s => {
            const st = an?.segments.find((x: any) => x.segment === s.csv); const r = reco[s.persona]; const p = PERSONAS.find(x => x.id === s.persona)!
            return (
              <section key={s.key} id={s.key} className="card pad" style={{ scrollMarginTop: 90 }}>
                <div className="row between wrap"><div><div style={{ fontSize: 34 }}>{s.icon}</div><h2 style={{ fontSize: 30 }}>{s.name}</h2><div className="muted">{s.who}</div></div><span className="badge blue">{s.share}</span></div>
                <div className="grid2e mt">
                  <div><h4>What they struggle with</h4><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.7 }}>{s.pain.map(x => <li key={x}>{x}</li>)}</ul></div>
                  <div><h4>How SYNC fits</h4>{s.plan.map(x => <div key={x} className="row" style={{ alignItems: 'flex-start', margin: '6px 0' }}><Check size={16} color="#0f9d6b" style={{ flex: 'none', marginTop: 4 }} /><span>{x}</span></div>)}</div>
                </div>
                {st && <div className="kpis mt">
                  <div className="card stat"><span>Activation today</span><b>{st.activation}%</b></div><div className="card stat"><span>Avg bundle / month</span><b>{inr(st.avg_value)}</b></div>
                  <div className="card stat"><span>Days to go live today</span><b>{st.days}</b></div><div className="card stat"><span>6-month churn</span><b>{st.churn}%</b></div></div>}
                {r && <div className="card mt" style={{ background: 'var(--bg)', boxShadow: 'none' }}><div className="pad">
                  <div className="row between wrap"><div><span className="eyebrow">Example: {p.t}</span><div className="muted sm">{p.d}</div></div><div className="price" style={{ fontSize: 34 }}>{inr(r.quote.monthly_total)}<span className="muted sm" style={{ fontWeight: 600 }}> /mo incl. GST</span></div></div>
                  <div className="mt">{r.quote.lines.map((l: any) => <div key={l.product_id} className="totalbar sm"><span>{l.name} × {l.qty}</span><span>{inr(l.monthly)}</span></div>)}</div>
                  <button className="btn primary mt" onClick={() => open(s.persona)}>Open this quote <ArrowRight size={16} /></button></div></div>}
              </section>)
          })}
        </div>
      </div>
    </main>
  )
}

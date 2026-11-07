/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Lock, Minus, Plus, TrendingDown, TriangleAlert } from 'lucide-react'
import { CAT_ICON, api, inr } from '../api'
import { NetworkResult } from './Network'
import { useStore } from '../store'

export default function Quote() {
  const { reco, sel, setSel, contract, setContract, session, setSession, refreshReco } = useStore()
  const [q, setQ] = useState<any>(null)
  const [problems, setProblems] = useState<any[]>([])
  const [gst, setGst] = useState('')
  const [gstMsg, setGstMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pin, setPin] = useState(session?.slots?.pincode || '')
  const [net, setNet] = useState<any>(null)
  const [netErr, setNetErr] = useState('')
  const nav = useNavigate()
  const p = reco?.profile
  const products: Record<string, any> = useMemo(() => Object.fromEntries((reco?.items || []).map((i: any) => [i.product_id, i])), [reco])

  const items = useMemo(() => Object.entries(sel).filter(([, v]) => v.on).map(([product_id, v]) => ({ product_id, qty: v.qty })), [sel])
  useEffect(() => {
    if (!p) return
    const t = setTimeout(async () => {
      if (!items.length) { setQ(null); return }
      try {
        const r = await api('/check-bundle', { items, contract, spend: p.monthly_spend || 0, city_tier: p.city_tier, employees: p.employees || 3, sites: p.sites || 1, has_gstin: !!p.has_gstin, gstin_active: p.gstin_active })
        setQ(r.quote); setProblems(r.problems)
      } catch { setQ(null) }
    }, 120)
    return () => clearTimeout(t)
  }, [items, contract, p])

  if (!reco) return (
    <main className="page narrow center"><h2>No bundle yet</h2><p className="muted">Talk to Sync first so we can build the right bundle for your business.</p><Link to="/advisor" className="btn primary">Start with Sync</Link></main>
  )

  const core = reco.items.filter((i: any) => i.tag === 'core')
  const addons = reco.items.filter((i: any) => i.tag === 'addon')
  const set = (pid: string, patch: Partial<{ qty: number; on: boolean }>) => setSel({ ...sel, [pid]: { ...sel[pid], ...patch } })

  async function unlock() {
    setBusy(true); setGstMsg(null)
    try {
      const r = await api('/lookup/gstin', { id: gst.trim().toUpperCase() })
      if (!r.valid_format) setGstMsg({ ok: false, text: 'That is not a valid 15-character GSTIN.' })
      else if (!r.checksum_ok) setGstMsg({ ok: false, text: 'Check digit does not match: please re-check for a typo.' })
      else if (!r.found) setGstMsg({ ok: false, text: 'GSTIN not found in the registry.' })
      else if (r.status !== 'Active') setGstMsg({ ok: false, text: `Registry status is ${r.status}: GSTIN-only products cannot be sold.` })
      else {
        setGstMsg({ ok: true, text: `Verified: ${r.trade_name} (Active).` })
        setSession({ ...(session || {}), slots: { ...(session?.slots || {}), has_gstin: true, gstin_active: true, gstin: gst.trim().toUpperCase(), business_name: r.trade_name } })
        await refreshReco({ has_gstin: true })
      }
    } finally { setBusy(false) }
  }

  async function checkNet() {
    setBusy(true); setNetErr('')
    try {
      const r = await api('/network/check', { pincode: pin, city: p.city })
      if (!r.ok) { setNetErr(r.error); setNet(null); return }
      setNet(r)
      setSession({ ...(session || {}), slots: { ...(session?.slots || {}), pincode: pin } })
      const hasFixed = items.some(i => ['P01', 'P02', 'P03', 'P05', 'P06'].includes(i.product_id)) && !p.force_conn
      if (r.recommended === 'airfiber' && hasFixed) await refreshReco({ force_conn: 'P04' })
      else if (r.recommended === 'fibre' && p.force_conn) await refreshReco({ force_conn: '' })
    } finally { setBusy(false) }
  }

  const listTotal = q ? q.lines.reduce((s: number, l: any) => s + l.list_price * l.qty, 0) : 0
  const ok = q && !problems.length

  return (
    <main className="page">
      <div className="row between wrap"><div><span className="eyebrow">Step 2 · Your quote</span><h1 style={{ marginTop: 6, fontSize: 'clamp(24px,3vw,34px)' }}>{reco.headline.replace('Rs ', '₹')}</h1></div>
        <div className="seg">{[12, 24].map(c => <button key={c} className={contract === c ? 'on' : ''} onClick={() => setContract(c)}>{c} months{c === 24 ? ' · lowest price' : ''}</button>)}</div></div>

      <div className="grid2 mt">
        <section>
          <div className="card pad">
            <div className="row between wrap"><h4>📡 Will it work at your address?</h4><span className="badge blue">Network Reality Check</span></div>
            <p className="muted sm" style={{ margin: '4px 0 10px' }}>Enter your shop's pincode. If fibre hasn't reached you we switch you to 5G AirFiber automatically, so the install never gets cancelled.</p>
            <div className="row wrap"><input aria-label="Pincode" className="input mono" style={{ maxWidth: 180 }} inputMode="numeric" maxLength={6} placeholder="Pincode" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && pin.length === 6 && checkNet()} />
              <button className="btn dark" disabled={pin.length !== 6 || busy} onClick={checkNet}>Check</button>
              <span className="muted sm">Try 411016 (Pune) to see the fallback.</span></div>
            {netErr && <p style={{ color: 'var(--red)', fontWeight: 600 }}>{netErr}</p>}
            {net && <div className="mt"><NetworkResult r={net} />{p.force_conn === 'P04' && reco.locked.some((l: any) => l.blockers.some((b: any) => b.code === 'dependency')) && <div className="banner warn mt"><span>⚠️</span><span>Because you're on wireless, {reco.locked.filter((l: any) => l.blockers.some((b: any) => b.code === 'dependency')).map((l: any) => l.name).join(', ')} {reco.locked.filter((l: any) => l.blockers.some((b: any) => b.code === 'dependency')).length > 1 ? 'are' : 'is'} not offered (needs a fixed line).</span></div>}</div>}
          </div>
          <div className="card pad mt">
            <h4>In your bundle</h4>
            {core.map((i: any) => <Line key={i.product_id} i={i} s={sel[i.product_id]} line={q?.lines.find((l: any) => l.product_id === i.product_id)} set={set} />)}
          </div>
          {addons.length > 0 && <div className="card pad mt">
            <h4>Add-ons <span className="muted sm" style={{ fontWeight: 500 }}>· switch on what you need</span></h4>
            {addons.map((i: any) => <Line key={i.product_id} i={i} s={sel[i.product_id]} line={q?.lines.find((l: any) => l.product_id === i.product_id)} set={set} />)}
          </div>}
          {reco.locked.length > 0 && <div className="card pad mt lock">
            <div className="row"><Lock size={18} /><h4>{reco.locked.length} more product{reco.locked.length > 1 ? 's' : ''} {p.has_gstin ? 'not available yet' : 'unlock with a GSTIN'}</h4></div>
            {reco.locked.map((l: any) => <div key={l.product_id} className="bundle-line"><div style={{ flex: 1 }}><b>{l.name}</b><div className="muted sm">{l.reason}</div>
              <div className="sm" style={{ color: 'var(--amber)', fontWeight: 600 }}>{l.blockers.map((b: any) => b.msg).join(' · ')}</div></div></div>)}
            {!p.has_gstin && <div className="mt"><label className="f">Enter your GSTIN to unlock them instantly</label>
              <div className="row"><input className="input mono" placeholder="e.g. 27AAAXX0000A1Z5" value={gst} onChange={e => setGst(e.target.value)} maxLength={15} />
                <button className="btn dark" disabled={gst.length < 15 || busy} onClick={unlock}>Verify</button></div>
              {gstMsg && <p className="sm" style={{ color: gstMsg.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{gstMsg.text}</p>}
              <p className="muted sm">Businesses with a GSTIN activate about 5× more often because more of our catalogue is open to them. No GSTIN? You can still buy everything on this page.</p></div>}
          </div>}
        </section>

        <aside className="sticky"><div className="card pad">
          <span className="eyebrow">Transparent monthly price</span>
          {q ? <>
            <div className="price big mt">{inr(q.monthly_total)}<span className="muted sm" style={{ fontWeight: 600 }}> /month</span></div>
            <div className="muted sm">incl. 18% GST · one invoice · one support number</div>
            <div className="divider" />
            {q.lines.map((l: any) => <div key={l.product_id} className="totalbar sm"><span>{l.name} × {l.qty}</span><span>{inr(l.monthly)}</span></div>)}
            <div className="divider" />
            <div className="totalbar sm"><span>Subtotal</span><span>{inr(q.subtotal_monthly)}</span></div>
            {q.bundle_discount > 0 && <div className="totalbar sm" style={{ color: 'var(--green)' }}><span>Bundle saving ({q.bundle_discount_pct}%)</span><span>−{inr(q.bundle_discount)}</span></div>}
            <div className="totalbar sm"><span>GST 18%</span><span>{inr(q.gst_monthly)}</span></div>
            <div className="totalbar big"><b>Monthly total</b><b>{inr(q.monthly_total)}</b></div>
            <div className="totalbar sm muted"><span>One-time setup (incl. GST)</span><span>{inr(q.setup_total)}</span></div>
            <div className="totalbar sm muted"><span>First invoice</span><span>{inr(q.first_invoice)}</span></div>
            {listTotal > q.monthly_ex_gst && <div className="assist" style={{ background: 'var(--green-soft)', color: '#0b6e4b' }}><TrendingDown size={16} style={{ flex: 'none', marginTop: 3 }} />
              <span>Buying these separately at list price would be {inr(listTotal)}/month before GST. You save {inr(listTotal - q.monthly_ex_gst)}/month by bundling and committing.</span></div>}
            {q.current_spend > 0 && <p className="muted sm">You told us you spend about {inr(q.current_spend)}/month on telecom today.</p>}
            <p className="muted sm">Live in about <b>{q.install_days + 1} days</b> (vs 10–14 days today). Prices use the {contract}-month rate; the longer you commit, the lower you pay.</p>
            {problems.map(pr => <div key={pr.product_id} className="assist" style={{ background: 'var(--red-soft)', color: 'var(--red-d)' }}><TriangleAlert size={16} style={{ flex: 'none', marginTop: 3 }} />
              <span><b>{products[pr.product_id]?.name}</b>: {pr.blockers.map((b: any) => b.msg).join(', ')}. Add a connectivity plan to continue.</span></div>)}
            {reco.assist.map((a: string) => <div key={a} className="assist"><BadgeCheck size={16} style={{ flex: 'none', marginTop: 3 }} /><span>{a} It is built into your journey, not an extra visit.</span></div>)}
            <button className="btn primary mt" style={{ width: '100%' }} disabled={!ok} onClick={() => nav('/kyc')}>Continue to KYC →</button>
          </> : <p className="muted mt">Switch on at least one product.</p>}
        </div></aside>
      </div>
    </main>
  )
}

function Line({ i, s, line, set }: { i: any; s?: { qty: number; on: boolean }; line: any; set: (pid: string, patch: Partial<{ qty: number; on: boolean }>) => void }) {
  if (!s) return null
  return (
    <div className="bundle-line" style={{ opacity: s.on ? 1 : .8 }}>
      <div className="cat-icon">{CAT_ICON[line?.category] || '📦'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between"><b>{line?.name || i.name}</b><button className={'toggle ' + (s.on ? 'on' : '')} onClick={() => set(i.product_id, { on: !s.on })} role="switch" aria-checked={s.on} aria-label={`Include ${line?.name || i.name}`} /></div>
        <div className="muted sm">{i.reason}</div>
        <div className="row mt" style={{ marginTop: 8 }}>
          <div className="qty"><button aria-label="Decrease quantity" onClick={() => set(i.product_id, { qty: Math.max(1, s.qty - 1) })}><Minus size={13} /></button><span aria-live="polite">{s.qty}</span><button aria-label="Increase quantity" onClick={() => set(i.product_id, { qty: Math.min(999, s.qty + 1) })}><Plus size={13} /></button></div>
          <span className="muted sm">{inr(line?.unit_price ?? i.unit_price)} {line?.unit ?? i.unit} /mo</span>
          <b style={{ marginLeft: 'auto' }}>{inr(line ? line.monthly : i.unit_price * s.qty)}</b>
        </div>
      </div>
    </div>
  )
}

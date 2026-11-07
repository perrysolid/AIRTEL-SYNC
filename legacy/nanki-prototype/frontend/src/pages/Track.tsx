/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, FastForward, MessageCircle, PhoneOff, ShieldCheck, Zap, TriangleAlert } from 'lucide-react'
import { api, inr } from '../api'
import { useStore } from '../store'
import { NetworkResult } from './Network'

const TABS = [['progress', '📦 Progress'], ['slot', '📅 Install slot'], ['health', '💓 Health & backup'], ['branch', '🏪 New branch'], ['msgs', '💬 Messages & privacy']]
const fd = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function Track() {
  const { id } = useParams()
  const { orderId } = useStore()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'progress'
  const [o, setO] = useState<any>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [toast, setToast] = useState('')
  const note = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600) }
  const load = useCallback(async (oid: string) => { try { setO(await api('/orders/' + oid)); setErr('') } catch { setErr('Order not found. Check the ID and try again.') } }, [])
  useEffect(() => { if (id) load(id); else if (orderId) nav('/track/' + orderId + (sp.get('tab') ? '?tab=' + sp.get('tab') : ''), { replace: true }) }, [id, orderId, load, nav, sp])
  useEffect(() => { if (!id) return; const t = setInterval(() => load(id), 5000); return () => clearInterval(t) }, [id, load])

  if (!id) return (
    <main className="page narrow center"><h2>Where is my order?</h2><p className="muted">Enter your order ID, or just reply STATUS on WhatsApp. No call needed.</p>
      <div className="row mt" style={{ justifyContent: 'center' }}><input aria-label="Order ID" className="input mono" style={{ maxWidth: 260 }} placeholder="ACC-XXXXXX" value={q} onChange={e => setQ(e.target.value.toUpperCase())} />
        <button className="btn primary" onClick={() => nav('/track/' + q)}>Track</button></div>
      <p className="muted sm mt">No order yet? <Link to="/advisor" style={{ color: 'var(--red)', fontWeight: 700 }}>Start with Sync</Link> or <Link to="/quote" style={{ color: 'var(--red)', fontWeight: 700 }}>see your quote</Link>.</p></main>)
  if (err) return <main className="page narrow center"><h3>{err}</h3><Link to="/track" className="btn ghost mt">Try again</Link></main>
  if (!o) return <main className="page narrow"><div className="skel" style={{ height: 200 }} /></main>

  const ff = async (days: number) => { const r = await api(`/orders/${o.id}/advance?days=${days}`, {}); setO(r); note(r.live ? 'Your services are live 🎉' : `Fast-forwarded ${days} day(s)`) }
  return (
    <main className="page">
      <div className="row between wrap"><div><span className="eyebrow">My service</span><h1 style={{ marginTop: 6, fontSize: 'clamp(24px,3vw,34px)' }}>{o.customer.business}</h1>
        <div className="muted sm">Order <span className="mono">{o.id}</span> · placed {fd(o.created)}{o.parent && <> · branch of <Link to={'/track/' + o.parent} style={{ textDecoration: 'underline' }}>{o.parent}</Link></>}</div></div>
        <div className="row wrap"><span className={'badge ' + (o.live ? 'green' : 'blue')}>{o.live ? 'Live' : 'In progress'}</span>
          <span className={'badge ' + (o.kyc_verdict === 'approved' ? 'green' : 'amber')}>KYC {o.kyc_verdict}</span>
          {o.outage_active && <span className="badge red">Outage</span>}</div></div>

      <div className="subtabs mt" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setSp({ tab: k })}>{l}</button>)}</div>

      <div className="grid2">
        <section>
          {tab === 'progress' && <Progress o={o} ff={ff} />}
          {tab === 'slot' && <Slot o={o} reload={load} note={note} />}
          {tab === 'health' && <Health o={o} reload={() => load(o.id)} note={note} />}
          {tab === 'branch' && <Branch o={o} note={note} reload={() => load(o.id)} />}
          {tab === 'msgs' && <Msgs o={o} note={note} />}
        </section>
        <aside className="sticky">
          <div className="card pad">
            <div className="row"><PhoneOff size={18} color="#e11d2e" /><b>Zero status calls</b></div>
            <p className="muted sm">Customers chase status about 3 times today. Here it's live, and every milestone also arrives on WhatsApp.</p>
            <div className="divider" />
            <b className="sm">Your products</b>
            {o.lines.map((l: any) => <div key={l.name} className="totalbar sm"><span>{l.name} × {l.qty}</span><span className="muted">~{fd(l.eta)}</span></div>)}
            <div className="totalbar big"><b>Monthly (one bill)</b><b>{inr(o.quote.monthly_total)}</b></div>
            <div className="muted sm">Payment: {o.payment.method} · {o.payment.mandate}</div>
          </div>
          {o.branches.length > 0 && <div className="card pad mt"><b>Your branches</b>{o.branches.map((b: any) => <div key={b.id} className="totalbar sm"><span>🏪 {b.name}</span><Link to={'/track/' + b.id} className="badge blue">{b.id}</Link></div>)}</div>}
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}

function Progress({ o, ff }: { o: any; ff: (d: number) => void }) {
  return (<div className="card pad">
    <div className="row between wrap" style={{ marginBottom: 22 }}>
      <div><div className="muted sm">{o.live ? 'Status' : 'Expected live by'}</div><div className="big-eta">{o.live ? 'Live ✓' : fd(o.target_eta)}</div>
        <div className="muted sm">{o.live ? 'Everything is active on one bill.' : `${o.days_left} day(s) to go · today the average is 17.6 days`}</div></div>
      <div className="row"><button className="btn ghost sm" onClick={() => ff(1)}><FastForward size={14} /> +1 day</button><button className="btn dark sm" onClick={() => ff(14)}>Demo: finish</button></div>
    </div>
    <div className="tl">{o.stages.map((s: any, i: number) => (
      <div key={s.key} className={'tl-item ' + s.state}><div className="dot">{s.state === 'done' ? <Check size={16} /> : i + 1}</div>
        <div><b>{s.title}</b> <span className="muted sm">· {fd(s.eta)}</span><div className="muted sm">{s.detail}</div>{s.state === 'current' && <div className="badge red" style={{ marginTop: 6 }}>Happening now</div>}</div></div>))}</div>
    {!o.slot && <div className="banner info mt"><span>📅</span><span>Pick a convenient installation slot in the <b>Install slot</b> tab, or reply SCHEDULE on WhatsApp.</span></div>}
  </div>)
}

function Slot({ o, reload, note }: { o: any; reload: (id: string) => void; note: (m: string) => void }) {
  const [slots, setSlots] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { api(`/orders/${o.id}/slots`).then(setSlots) }, [o.id])
  async function pick(id: string) {
    setBusy(true)
    try { await api(`/orders/${o.id}/schedule`, { slot_id: id }); await reload(o.id); note(o.slot ? 'Rescheduled ✓' : 'Installation booked ✓') }
    catch (e: any) { note(e.message || 'Could not book that slot') } finally { setBusy(false) }
  }
  return (<div className="card pad">
    <h3>Installation slot</h3>
    {o.slot ? <div className="banner ok mt"><span>✅</span><div><b>Booked: {o.slot.label}</b><div className="sm">A technician arrives in that window; you'll get a WhatsApp reminder the evening before. Free reschedules left: {Math.max(0, 2 - o.reschedules)}.</div></div></div>
      : <p className="muted">Choose a time that suits your shop. No phone calls to fix a date.</p>}
    <div className="slotgrid mt">{slots.map(s => <button key={s.id} disabled={busy} className={'slot ' + (o.slot?.id === s.id ? 'on' : '')} onClick={() => pick(s.id)}>{new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}<small>{s.window}</small></button>)}</div>
  </div>)
}

function Health({ o, reload, note }: { o: any; reload: () => void; note: (m: string) => void }) {
  const [c, setC] = useState<any>(null)
  const [sph, setSph] = useState<number | null>(null)
  const [dep, setDep] = useState(60)
  const [hrs, setHrs] = useState(4)
  const pull = useCallback(async () => {
    const qs = new URLSearchParams({ dependent_pct: String(dep), hours: String(hrs) }); if (sph) qs.set('sales_per_hour', String(sph))
    const r = await api(`/orders/${o.id}/continuity?${qs}`); setC(r); if (sph === null) setSph(r.sales_per_hour)
  }, [o.id, dep, hrs, sph])
  useEffect(() => { pull() /* eslint-disable-next-line */ }, [dep, hrs, sph, o.outage_active, o.lines.length])
  if (!c) return <div className="skel" style={{ height: 240 }} />
  const act = async (a: string) => { await api(`/orders/${o.id}/outage?action=${a}`, {}); reload(); note(a === 'start' ? 'Outage simulated: see the WhatsApp message' : 'Link restored') }
  const failover = async () => { try { await api(`/orders/${o.id}/failover`, {}); reload(); note('Backup failover added to your bundle ✓') } catch (e: any) { note(e.message) } }
  const online = !c.outage_active || c.has_failover
  const fixed = o.lines.some((l: any) => ['P01', 'P02', 'P03', 'P05', 'P06'].includes(l.product_id))
  return (<div>
    <div className="card pad">
      <div className="row between wrap"><div className="row"><span className={'pulse-live ' + (online ? '' : 'down')} /><h3>{!c.outage_active ? 'Online' : c.has_failover ? 'Online on backup' : 'Offline'}</h3></div>
        <div className="row"><button className="btn ghost sm" disabled={c.outage_active} onClick={() => act('start')}><Zap size={14} /> Simulate an outage</button>
          <button className="btn dark sm" disabled={!c.outage_active} onClick={() => act('end')}>Restore link</button></div></div>
      {c.outage_active && <div className={'banner mt ' + (c.has_failover ? 'ok' : 'bad')}><span>{c.has_failover ? '🛟' : '🚨'}</span><div>{c.has_failover ? <><b>Backup took over in {c.incidents[0]?.switch_seconds} seconds.</b> Billing and payments are still working while we fix the main link.</> : <><b>Your internet is down.</b> Ticket {c.incidents[0]?.ticket} was raised automatically and a technician is assigned (fix within 4 hours).</>}</div></div>}
      <p className="muted sm mt">Outage events here are simulated for the demo. In production, health comes from the router and network telemetry, and the same alerts go to WhatsApp.</p>
      {o.tickets.length > 0 && <div className="mt"><b className="sm">Tickets &amp; SLA</b>{o.tickets.map((t: any) => <div key={t.id} className="totalbar sm"><span><span className="mono">{t.id}</span> · {t.kind.replace('_', ' ')} · {t.assigned_to}</span><span className={'badge ' + (t.status === 'Resolved' ? 'green' : 'amber')}>{t.status} · SLA {t.sla_hours}h</span></div>)}</div>}
    </div>

    <div className="card pad mt">
      <h4>🛟 Is backup worth it for you?</h4>
      <p className="muted sm">Move the sliders to match your shop. This is a simple estimate, not a promise.</p>
      <label className="f mt" htmlFor="sph">Sales per hour: {inr(sph || c.sales_per_hour)}</label>
      <input id="sph" className="range" type="range" min={200} max={20000} step={100} value={sph || c.sales_per_hour} onChange={e => setSph(+e.target.value)} />
      <label className="f" htmlFor="dep">Share of sales that needs the internet (UPI, billing, orders): {dep}%</label>
      <input id="dep" className="range" type="range" min={10} max={100} step={5} value={dep} onChange={e => setDep(+e.target.value)} />
      <label className="f" htmlFor="hrs">Hours offline per month: {hrs}</label>
      <input id="hrs" className="range" type="range" min={0} max={20} step={0.5} value={hrs} onChange={e => setHrs(+e.target.value)} />
      <div className="kpis mt"><div className="card stat"><span>Estimated loss / month</span><b style={{ color: 'var(--red)' }}>{inr(c.est_loss_month)}</b></div>
        <div className="card stat"><span>Backup costs</span><b>{inr(c.failover_monthly_with_gst)}</b><span>/month incl. GST</span></div>
        <div className="card stat"><span>Pays for itself if offline</span><b>{c.breakeven_hours_month ?? '–'} h</b><span>per month</span></div></div>
      {c.has_failover ? <div className="banner ok mt"><span>✅</span><span>Backup 4G/5G Failover is already in your bundle.</span></div>
        : c.can_add_failover ? <div className="row mt wrap"><div className={'banner ' + (c.worth_it ? 'warn' : 'info')} style={{ flex: 1 }}><span>{c.worth_it ? '⚠️' : 'ℹ️'}</span><span>{c.worth_it ? 'At these numbers, one bad month of outages costs more than backup would.' : 'At these numbers backup is optional, but it protects you in a bad month.'}</span></div>
          <button className="btn primary" onClick={failover}>Add Backup 4G/5G</button></div>
          : <div className="banner info mt"><TriangleAlert size={16} style={{ flex: 'none', marginTop: 3 }} /><span>{fixed ? '' : 'Backup failover needs a fixed-line plan (fibre or leased line). On 5G AirFiber, ask your partner about adding a fixed line.'}</span></div>}
      <p className="muted sm">{c.assumptions}</p>
    </div>
  </div>)
}

function Branch({ o, note, reload }: { o: any; note: (m: string) => void; reload: () => void }) {
  const [f, setF] = useState({ name: '', city: 'Nashik', pincode: '422001' })
  const [pv, setPv] = useState<any>(null)
  const [done, setDone] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const body = (confirm: boolean) => ({ name: f.name || `${f.city} branch`, city: f.city, pincode: f.pincode, confirm })
  async function preview() { setBusy(true); setDone(null); try { setPv(await api(`/orders/${o.id}/branch`, body(false))) } finally { setBusy(false) } }
  async function create() { setBusy(true); try { const r = await api(`/orders/${o.id}/branch`, body(true)); setDone(r); setPv(null); reload(); note('Branch created ✓') } finally { setBusy(false) } }
  return (<div className="card pad">
    <span className="badge red">Branch-in-a-Box</span>
    <h3 style={{ marginTop: 8 }}>Open a new location in one tap</h3>
    <p className="muted">We copy your current setup to the new address, reuse your verified KYC, check the network there and book the install. You only upload the new address proof.</p>
    <div className="row wrap" style={{ alignItems: 'flex-end' }}>
      <div style={{ flex: 2, minWidth: 160 }}><label className="f" htmlFor="bn">Branch name</label><input id="bn" className="input" value={f.name} placeholder="e.g. Gangapur Road" onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div style={{ flex: 1, minWidth: 130 }}><label className="f" htmlFor="bc">City</label><select id="bc" className="input" value={f.city} onChange={e => setF({ ...f, city: e.target.value })}>{['Nashik', 'Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kochi', 'Jaipur', 'Surat', 'Nagpur', 'Indore'].map(c => <option key={c}>{c}</option>)}</select></div>
      <div style={{ flex: 1, minWidth: 120 }}><label className="f" htmlFor="bp">Pincode</label><input id="bp" className="input mono" maxLength={6} value={f.pincode} onChange={e => setF({ ...f, pincode: e.target.value.replace(/\D/g, '') })} /></div>
      <button className="btn dark" disabled={f.pincode.length !== 6 || busy} onClick={preview}>Preview</button>
    </div>
    {pv && <div className="mt">
      <h4>Copied from your head office</h4>
      {pv.quote.lines.map((l: any) => <div key={l.product_id} className="totalbar sm"><span>{l.name} × {l.qty}</span><span>{inr(l.monthly)}</span></div>)}
      <div className="totalbar big"><b>New branch / month (incl. GST)</b><b>{inr(pv.quote.monthly_total)}</b></div>
      <div className="muted sm">Your total after adding it: {inr(pv.total_after)}/month · one bill</div>
      <div className="mt"><NetworkResult r={pv.network} /></div>
      {pv.removed.length > 0 && <div className="banner warn mt"><span>⚠️</span><span>Not copied because it needs a fixed line: {pv.removed.join(', ')}.</span></div>}
      <div className="banner ok mt"><span>✅</span><span><b>KYC reused.</b> Only needed: {pv.needs.join(', ')}.</span></div>
      <button className="btn primary mt" disabled={busy} onClick={create}>Create this branch</button>
    </div>}
    {done && <div className="banner ok mt"><span>🏪</span><div><b>Branch created: order {done.order.id}</b><div className="sm">Expected live by {fd(done.order.target_eta)}. <Link to={'/track/' + done.order.id + '?tab=slot'} style={{ textDecoration: 'underline', fontWeight: 700 }}>Pick its install slot →</Link></div></div></div>}
  </div>)
}

function Msgs({ o, note }: { o: any; note: (m: string) => void }) {
  return (<div>
    <div className="card pad"><div className="row"><MessageCircle size={18} color="#128c7e" /><b>WhatsApp updates</b></div>
      {o.messages.map((m: any, i: number) => <div key={i} className="wa-b in" style={{ maxWidth: '100%', marginTop: 8, background: '#f0fbf4' }}>{m.text}<div className="muted sm" style={{ textAlign: 'right' }}>day {m.day}</div></div>)}
      <Link to="/whatsapp" className="btn ghost sm mt">Open the WhatsApp chat</Link></div>
    <div className="card pad mt"><div className="row"><ShieldCheck size={18} color="#0f9d6b" /><b>Your privacy</b></div>
      <p className="muted sm">Consent {o.consent?.id} · {o.consent?.notice_version}. {o.consent?.retention}.</p>
      <div className="row wrap"><button className="btn ghost sm" onClick={() => note('Consent withdrawal request logged (demo)')}>Withdraw consent</button>
        <button className="btn ghost sm" onClick={() => note('Erasure request queued (demo)')}>Erase my documents</button></div></div>
  </div>)
}

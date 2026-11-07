/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Handshake, PhoneCall, Sparkles, Target } from 'lucide-react'
import { api, inr } from '../api'

const TABS = ['Overview', 'Priority leads', 'Advisor hand-offs', 'Segments & economics', 'Success metrics', 'Lead rescue']

export default function Ops() {
  const [tab, setTab] = useState(0)
  const [a, setA] = useState<any>(null)
  const [l, setL] = useState<any>(null)
  const [h, setH] = useState<any[]>([])
  const [seg, setSeg] = useState('')
  const [toast, setToast] = useState('')
  const [rescue, setRescue] = useState<any[]>([])
  useEffect(() => { api('/ops/analytics').then(setA) }, [])
  useEffect(() => { const f = () => api('/ops/rescue').then(setRescue).catch(() => {}); f(); const t = setInterval(f, 5000); return () => clearInterval(t) }, [])
  useEffect(() => { setL(null); api('/ops/leads?limit=40' + (seg ? '&segment=' + encodeURIComponent(seg) : '')).then(setL).catch(() => setL({ leads: [], model: {} })) }, [seg])
  useEffect(() => { const f = () => api('/ops/handoffs').then(setH); f(); const t = setInterval(f, 4000); return () => clearInterval(t) }, [])
  const note = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }
  if (!a) return <main className="page"><div className="skel" style={{ height: 300 }} /></main>
  const k = a.kpis

  return (
    <main className="page">
      <span className="eyebrow">Stretch · Back-office for sales &amp; partners</span>
      <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(26px,3.4vw,38px)' }}>Partner console</h1>
      <p className="muted">The digital journey hands over the leads it cannot close, with context, and ranks the rest by likelihood to activate. Field sales and partners spend time where it pays.</p>
      <div className="tabs">{TABS.map((t, i) => <button key={t} className={'chip ' + (tab === i ? 'on' : '')} onClick={() => setTab(i)}>{t}{i === 2 && h.length ? ` (${h.length})` : ''}</button>)}</div>

      {tab === 0 && <>
        <div className="kpis">
          {[['Leads (Q2)', k.leads.toLocaleString()], ['Activated', `${k.activated} · ${k.conv}%`], ['Lead → live', `${k.days} days`], ['Status calls / customer', k.calls],
            ['Blended CAC', inr(k.cac)], ['6-month churn', k.churn + '%'], ['NPS (activated)', k.nps]].map(([t, v]) => <div key={t as string} className="card stat"><span>{t}</span><b>{v}</b></div>)}
        </div>
        <div className="grid2 mt2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card pad"><h4>Funnel: where we leak</h4>
            {a.funnel.map((f: any, i: number) => <div className="funnel-row" key={f.stage}><span>{f.stage}</span><div className="bar"><i style={{ width: (100 * f.count / a.funnel[0].count) + '%', background: i === 3 ? 'var(--red)' : 'var(--ink)' }} /></div><span><b>{f.count.toLocaleString()}</b> <span className="muted sm">{i ? f.pct_prev + '%' : ''}</span></span></div>)}
            <p className="muted sm">Steepest step: needs assessed → quote accepted (44%). Top reasons there are price, quote complexity and quote delay, all addressed by the instant, plain-language quote.</p></div>
          <div className="card pad"><h4>Why prospects drop</h4>
            <div style={{ height: 300 }}><ResponsiveContainer><BarChart data={a.drop_reasons} layout="vertical" margin={{ left: 40 }}><CartesianGrid horizontal={false} stroke="#ece6dc" /><XAxis type="number" /><YAxis type="category" dataKey="reason" width={190} tick={{ fontSize: 12 }} /><Tooltip />
              <Bar dataKey="count" radius={6}>{a.drop_reasons.map((_: any, i: number) => <Cell key={i} fill={i < 3 ? '#e11d2e' : '#12141c'} />)}</Bar></BarChart></ResponsiveContainer></div></div>
        </div>
        <div className="card pad mt"><div className="row"><Sparkles size={18} color="#e11d2e" /><h4>GSTIN is the biggest single lever</h4></div>
          <p>Leads with a GSTIN activate at <b>{a.gstin.with}%</b>, without at <b>{a.gstin.without}%</b>, and <b>{a.gstin.leads_without.toLocaleString()}</b> leads have none. Our advisor verifies a GSTIN in one tap, unlocks gated products and shows what a GSTIN would unlock, while still selling the full GSTIN-free range.</p></div>
      </>}

      {tab === 1 && <>
        <div className="row between wrap"><div className="row wrap" style={{ gap: 6 }}>{['', 'Micro retail & services', 'Professional offices', 'Small multi-site businesses', 'Small manufacturers'].map(s => <button key={s} className={'chip ' + (seg === s ? 'on' : '')} onClick={() => setSeg(s)}>{s || 'All segments'}</button>)}</div></div>
        {l && l.model?.auc && <div className="kpis mt">
          <div className="card stat"><span>Model hold-out AUC</span><b>{l.model.auc}</b></div><div className="card stat"><span>Top-decile lift</span><b>{l.model.lift}×</b></div>
          <div className="card stat"><span>Open leads scored</span><b>{l.pool.toLocaleString()}</b></div><div className="card stat"><span>Recoverable MRR (fixable drops)</span><b>{inr(l.recoverable_monthly_value)}</b></div></div>}
        <div className="card mt scroll-x">{!l ? <div className="skel" style={{ height: 300 }} /> : <table className="tbl"><thead><tr><th>Lead</th><th>Segment · city</th><th>Propensity</th><th>Exp. MRR</th><th>Why (model)</th><th>Stuck on</th><th /></tr></thead><tbody>
          {l.leads.map((r: any) => <tr key={r.lead_id}>
            <td><b>{r.business}</b><div className="muted sm">{r.lead_id} · {r.type}</div></td><td>{r.segment}<div className="muted sm">{r.city} · {r.language} · via {r.source}</div></td>
            <td style={{ minWidth: 120 }}><b>{(r.score * 100).toFixed(1)}%</b><div className="bar"><i style={{ width: Math.min(100, r.score * 400) + '%' }} /></div><span className={'badge ' + (r.priority === 'Call now' ? 'red' : r.priority.startsWith('Nurture') ? 'amber' : 'gray')}>{r.priority}</span></td>
            <td><b>{inr(r.exp_value)}</b></td><td className="sm">{r.reasons.map((x: string) => <div key={x} style={{ color: x.startsWith('▲') ? 'var(--green)' : 'var(--muted)' }}>{x}</div>)}</td>
            <td className="sm">{r.stage}{r.drop_reason && <div className="muted">{r.drop_reason}</div>}{r.fixable && <span className="badge green">fixable by SYNC</span>}</td>
            <td><button className="btn ghost sm" onClick={() => note(`${r.business}: queued for ${r.priority === 'Call now' ? 'a call today' : 'WhatsApp nurture'} in ${r.language}`)}><PhoneCall size={13} /> Act</button></td></tr>)}</tbody></table>}</div>
        <p className="muted sm">Logistic regression on the 5,000-lead file (segment, source, language, city tier, GSTIN/Udyam, size, current setup, interest). Score = P(activation); ranked by expected monthly value. Hold-out is chronological (last 25% of the quarter).</p>
      </>}

      {tab === 2 && <>
        {h.length === 0 ? <div className="card pad center"><Handshake size={28} /><h4 style={{ marginTop: 8 }}>No hand-offs yet</h4><p className="muted">When the advisor can&apos;t close a lead (customer asks for a person, or it can&apos;t understand them), the full context lands here with a suggested partner and SLA. Try &ldquo;talk to a person&rdquo; in the Advisor or on WhatsApp.</p></div> :
          h.map(x => <div key={x.id} className="card pad mt"><div className="row between wrap"><div><b>{x.business_type}</b> · {x.city || 'city n/a'} <span className="badge gray">{x.channel}</span> <span className="badge blue">{x.language}</span></div>
            <div className="row"><span className={'badge ' + (x.priority === 'Call now' ? 'red' : 'amber')}>{x.priority} · {(x.score * 100).toFixed(1)}%</span>
              <select className="input" style={{ width: 'auto', padding: '6px 10px' }} value={x.status} onChange={async e => { await api(`/ops/handoffs/${x.id}/status?status=${e.target.value}`, {}); setH(await api('/ops/handoffs')) }}>{['New', 'Contacted', 'Quote sent', 'Won', 'Lost'].map(s => <option key={s}>{s}</option>)}</select></div></div>
            <div className="muted sm mt">Reason: {x.reason.replace(/_/g, ' ')} · assign to <b>{x.partner}</b> · SLA {x.sla} · {x.employees ?? '?'} staff, {x.sites ?? '?'} site(s) · needs: {x.needs.join(', ') || 'unknown'}</div>
            <div className="mt">{x.transcript.map((t: string, i: number) => <div key={i} className="bub user" style={{ display: 'inline-block', margin: '4px 6px 0 0', fontSize: 13 }}>{t}</div>)}</div></div>)}
      </>}

      {tab === 3 && <>
        <div className="card pad"><h4>Segment economics (Apr–Jun 2026, from the lead file)</h4>
          <div className="scroll-x"><table className="tbl"><thead><tr><th>Segment</th><th>Share of leads</th><th>Activation</th><th>Avg bundle / mo</th><th>CAC / activation</th><th>CAC payback</th><th>6-mo churn</th><th>Days to live</th></tr></thead><tbody>
            {a.segments.map((s: any) => <tr key={s.segment}><td><b>{s.segment}</b></td><td>{s.share}%</td><td>{s.activation}%</td><td>{inr(s.avg_value)}</td><td>{inr(s.cac)}</td>
              <td><span className={'badge ' + (s.payback_months > 6 ? 'red' : s.payback_months > 2 ? 'amber' : 'green')}>{s.payback_months} months of revenue</span></td><td>{s.churn}%</td><td>{s.days}</td></tr>)}</tbody></table></div>
          <p className="muted sm">Micro retail is 54% of leads but needs ~8 months of revenue to repay a field-sales CAC. It only works if acquisition is near-zero-touch, which is what the advisor, WhatsApp and partner-assisted channels are for.</p></div>
        <div className="grid2 mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card pad"><h4>CAC per activation by lead source</h4><div style={{ height: 260 }}><ResponsiveContainer><BarChart data={a.sources} margin={{ left: 10 }}><CartesianGrid vertical={false} stroke="#ece6dc" /><XAxis dataKey="source" tick={{ fontSize: 11 }} interval={0} angle={-15} height={50} /><YAxis tickFormatter={v => '₹' + v / 1000 + 'k'} /><Tooltip formatter={(v: any) => inr(v)} />
            <Bar dataKey="cac" radius={6}>{a.sources.map((s: any, i: number) => <Cell key={i} fill={s.cac > 15000 ? '#12141c' : '#e11d2e'} />)}</Bar></BarChart></ResponsiveContainer></div>
            <p className="muted sm">WhatsApp, referral and inbound activate at ₹4–5k vs ₹24k for field sales. SYNC shifts volume to the cheap channels and keeps field sales for complex deals.</p></div>
          <div className="card pad"><h4>Recommended roll-out order</h4>
            <ol style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              <li><b>Professional offices</b>: 11% activation, ₹6.8k bundle, lowest CAC payback. Clinics, CA, coaching.</li>
              <li><b>Small multi-site</b>: ₹31k bundle, high LTV; digital quote + partner-led installs.</li>
              <li><b>Micro retail</b> via WhatsApp + referrals only, with a ₹2.5k starter bundle on a short contract.</li>
              <li><b>Manufacturers</b>: assisted journey (site survey); digital for discovery, KYC and tracking.</li>
            </ol></div>
        </div>
      </>}

      {tab === 4 && <div className="card pad"><div className="row"><Target size={18} color="#e11d2e" /><h4>Success metrics &amp; targets (12 months)</h4></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Metric</th><th>Baseline (data)</th><th>Target</th><th>How SYNC moves it</th></tr></thead><tbody>
          {[['Lead → activation conversion', `${k.conv}%`, '15%', 'Instant quote fixes the 44% step; KYC assist fixes document drop-offs'],
            ['Time to activate', `${k.days} days`, '≤ 3 days (digital products), ≤ 10 days (installs)', 'Pre-verified KYC, auto-scheduling, SIM/cloud products activate instantly'],
            ['Cost of acquisition / activation', inr(k.cac), '< ₹4,000 blended; < ₹3,000 for micro', 'Shift to WhatsApp/web/referral; partners paid per verified activation'],
            ['Status-chase calls / customer', k.calls, '< 0.5', 'Self-serve tracker + proactive WhatsApp milestones'],
            ['6-month churn', `${k.churn}%`, '< 10% (micro < 15%)', 'Right-sized bundles; NPS tracked weekly; 24-month rate nudges']].map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 0 ? <b>{c}</b> : c}</td>)}</tr>)}</tbody></table></div>
        <p className="muted sm">Guardrail metrics: KYC first-pass approval rate, advisor hand-off rate (healthy 15–25%), quote-to-order rate, partner SLA adherence, DPDP consent withdrawals.</p></div>}
      {tab === 5 && <>
        <div className="card pad"><div className="row"><Handshake size={18} color="#e11d2e" /><h4>Lead rescue: abandoned purchases</h4></div>
          <p className="muted">Customers who built a bundle but didn't finish are nudged on WhatsApp with their exact next step. {a.kpis.fixable_drops.toLocaleString()} of last quarter's drops were for reasons a better journey fixes (slow quote, paperwork, unreachable).</p></div>
        {rescue.length === 0 ? <div className="card pad mt center muted">No abandoned bundles right now. Build a bundle in the Advisor and leave before checkout, and it will appear here.</div> :
          rescue.map(r => <div key={r.session} className="card pad mt"><div className="row between wrap"><div><b>{r.business}</b> · {r.city} <span className="badge gray">{r.channel}</span></div><b>{inr(r.monthly)}/mo</b></div>
            <div className="bub advisor mt" style={{ maxWidth: '100%' }}>{r.nudge}</div>
            <button className="btn ghost sm mt" onClick={() => note('Nudge sent on WhatsApp (demo)')}>Send nudge</button></div>)}
      </>}
      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

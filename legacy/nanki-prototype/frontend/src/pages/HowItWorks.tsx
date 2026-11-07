/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { FIXES } from '../data'

const STAGES = [
  ['🤖', 'Discover', 'Chat or speak to Sync in your language. It asks about your business, size, location and current setup, then recommends a bundle from the catalogue and explains why. Eligibility rules (city, size, GSTIN, dependencies) are applied by code, so you are never shown something we can’t sell.', ['AI Business Advisor', 'Voice in 10 languages', 'WhatsApp or web']],
  ['💰', 'Price', 'One transparent monthly price with GST. Switch add-ons on and off, choose 12 or 24 months, and check your pincode. If fibre has not reached you, the bundle switches to 5G AirFiber automatically.', ['Instant quote', 'Network Reality Check', 'Savings vs list price']],
  ['🪪', 'Verify', 'Consent first, then GSTIN and Udyam lookup, document OCR and cross-document checks. You see exactly what passed and what needs a fix. Sign with an OTP and set up auto-pay.', ['Smart KYC', 'DPDP consent', 'e-Sign']],
  ['📅', 'Activate', 'Pick your own installation slot. SIM and cloud products activate instantly while hardware ships. Everything shows on a live tracker and arrives on WhatsApp.', ['Slot scheduler', 'Live tracker', 'Day-0 activation']],
  ['💓', 'Operate', 'Service health, outage alerts, tickets with an SLA clock, a backup link and a troubleshooter on WhatsApp. Scam Shield checks anything suspicious you receive.', ['Health & Continuity', 'Scam Shield', 'AI troubleshooter']],
  ['🌱', 'Grow', 'Open a new branch by copying your setup. SYNC suggests upgrades as you grow, reminds you before renewals and keeps your documents in one place.', ['Branch-in-a-Box', 'Next best offer', 'Business vault']],
]

export default function HowItWorks() {
  const [an, setAn] = useState<any>(null)
  useEffect(() => { api('/ops/analytics').then(setAn).catch(() => {}) }, [])
  const count = (reason: string) => an?.all_drop_reasons?.find((d: any) => d.reason === reason)?.count
  return (
    <main className="page narrow" style={{ maxWidth: 1000 }}>
      <section className="phero"><span className="eyebrow" style={{ color: '#ff8a95' }}>How it works</span><h1>From “I need internet” to live, in one sitting</h1>
        <p>Six stages, each designed to remove a delay we can see in the data.</p></section>

      <div className="steps-v mt2" style={{ marginTop: 36 }}>
        {STAGES.map(([e, t, d, tags], i) => (
          <div className="sv" key={t as string}><div className="num">{e as string}</div>
            <div><span className="eyebrow">Stage {i + 1}</span><h3 style={{ fontSize: 24, margin: '2px 0 6px' }}>{t as string}</h3><p className="muted" style={{ margin: 0 }}>{d as string}</p>
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>{(tags as string[]).map(x => <span key={x} className="tag">{x}</span>)}</div></div></div>))}
      </div>

      <section className="card pad mt2" style={{ marginTop: 20 }}>
        <span className="eyebrow">Built from the data</span><h2 className="sec-title">Every drop-off has a fix</h2>
        <p className="muted">Only 7.4% of last quarter's leads activated. These are the reasons prospects gave for dropping out, and what SYNC does about each.</p>
        <div className="table-wrap"><table className="tbl"><thead><tr><th>Why they dropped</th><th>Leads lost</th><th>What SYNC does</th></tr></thead><tbody>
          {FIXES.map(f => <tr key={f.reason}><td><b>{f.reason}</b></td><td>{count(f.reason)?.toLocaleString() ?? '…'}</td><td>{f.fix}</td></tr>)}</tbody></table></div>
        <p className="muted sm">Source: smb_leads.csv, Apr–Jun 2026 (synthetic). Fixes are our design; the effect on conversion is a target, not a measured result.</p>
      </section>

      <section className="grid2e mt">
        <div className="card pad"><h4>Rules the AI cannot break</h4><p className="muted">The advisor can understand free text and explain in your language, but eligibility, dependencies and prices always come from the catalogue rules. If a product needs GSTIN or a connectivity plan, it is locked with the reason, never silently sold.</p></div>
        <div className="card pad"><h4>People stay in the loop</h4><p className="muted">When Sync can’t close a lead, or you ask for a person, a local partner gets the whole conversation and a 2-hour call-back. Dedicated links include a site-survey video call with a field engineer.</p></div>
      </section>
      <div className="center mt2" style={{ marginTop: 32 }}><Link to="/advisor" className="btn primary lg">Start with Sync</Link></div>
    </main>
  )
}

import { Link } from 'react-router-dom'
import { Calculator, Handshake, HardHat, Store } from 'lucide-react'

const ROLES = [
  [HardHat, 'Field sales', 'Keep the complex deals', 'Dedicated links, SD-WAN and multi-site rollouts need a human. They arrive with the customer’s needs, KYC and site details already filled in.'],
  [Store, 'Channel partners', 'Assisted digital journey', 'Sit with a shop owner and complete the whole journey on their own phone. The customer approves consent and the e-sign themselves.'],
  [Calculator, 'CAs & accountants', 'Onboard many clients', 'Accountants already hold their clients’ GST and Udyam details. They can start many onboardings, with each client consenting separately.'],
] as const

export default function Partners() {
  return (
    <main className="page" style={{ maxWidth: 1000 }}>
      <section className="phero"><span className="eyebrow" style={{ color: '#ff8a95' }}>Partners</span><h1>Digital that adds to your field force, never replaces it</h1>
        <p>SYNC takes over the paperwork and the first conversation, so partners spend time where people matter: complex needs, trust and installation.</p></section>

      <div className="grid3 mt">{ROLES.map(([I, who, t, d]) => <div key={who} className="card pcard"><I size={28} color="#e11d2e" /><span className="eyebrow">{who}</span><h4>{t}</h4><p className="muted sm" style={{ margin: 0 }}>{d}</p></div>)}</div>

      <section className="card pad mt"><h3>The hand-off, step by step</h3>
        <div className="steps-v" style={{ marginTop: 16 }}>
          {[['1', 'Sync can’t close it', 'The customer asks for a person, the advisor can’t understand, or the bundle needs a site survey.'], ['2', 'Context travels with the lead', 'Business type, size, needs, language, conversation and a propensity score land in the partner console.'],
            ['3', 'Routed by city and language', 'A partner for that city gets it with a 2-hour call-back SLA.'], ['4', 'Partner closes, platform completes', 'KYC, quote, e-sign and tracking run on the same journey, with consent on the customer’s phone.']].map(([n, t, d]) => (
            <div className="sv" key={n}><div className="num" style={{ fontSize: 20 }}>{n}</div><div><h4>{t}</h4><p className="muted" style={{ margin: '2px 0 0' }}>{d}</p></div></div>))}
        </div></section>

      <section className="grid2e mt">
        <div className="card pad"><h4>The partner console</h4><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
          <li>Leads ranked by a model trained on 5,000 leads, with the reasons</li><li>Advisor hand-offs with full transcript</li><li>Lead rescue for abandoned purchases</li><li>Segment economics and roll-out order</li></ul>
          <Link to="/ops" className="btn primary mt"><Handshake size={16} /> Open the console</Link></div>
        <div className="card pad"><h4>How partners are measured</h4><ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
          <li>Conversion from hand-off to activation</li><li>Installation quality and time-to-live</li><li>Customer satisfaction after activation</li><li>SLA adherence on call-backs</li></ul>
          <p className="muted sm">Commission is paid per verified activation. The rate card is to be set by Accel; none is promised here.</p></div>
      </section>
    </main>
  )
}

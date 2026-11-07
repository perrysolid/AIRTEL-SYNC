import { Link } from 'react-router-dom'
import { Lock, EyeOff, Clock, Trash2, ShieldCheck, FileCheck2 } from 'lucide-react'
import { useStore } from '../store'

const PRINCIPLES = [
  [FileCheck2, 'Consent first', 'Before any document is read we show a plain-language notice with granular choices. Required and optional purposes are separate. Marketing is off by default.'],
  [EyeOff, 'Purpose limitation', 'Each item is used only for the step it was collected for: KYC data for verification, phone number for order updates. Nothing is reused for another purpose without asking.'],
  [Lock, 'Data minimisation', 'We extract only the fields each check needs. Identifiers are masked on screen and in logs (••••1234). We never send IDs or documents to an AI model.'],
  [Clock, 'Retention', 'Uploaded documents are deleted 30 days after verification. Order and billing records are kept only as long as the law requires.'],
  [Trash2, 'Your rights', 'Withdraw consent, correct or erase your data from your order page at any time. Withdrawal is as easy as giving consent.'],
  [ShieldCheck, 'Security by design', 'Documents are processed in memory, access is role-based, partners act only with your consent on your own phone, and every consent has a receipt.'],
] as const

const TABLE = [
  ['Business type, city, size', 'Advisor', 'Recommend the right bundle', 'Until you buy, then with your order', 'Yes (to personalise)'],
  ['GSTIN / Udyam number', 'KYC', 'Look up your registration and check eligibility', 'Order lifetime (shown masked)', 'Yes (to verify)'],
  ['GST, Udyam, ID, address proof images', 'KYC', 'Read and cross-check details', 'Deleted 30 days after verification', 'Yes (to verify)'],
  ['Phone number', 'Order & WhatsApp', 'Send order updates, support', 'Order lifetime', 'Optional'],
  ['Pincode', 'Network check', 'Tell you what can be installed', 'Order lifetime', 'Yes (to install)'],
  ['Messages you check in Scam Shield', 'Scam Shield', 'Explain red flags', 'Not stored', 'You choose to share'],
]

export default function Privacy() {
  const { consent } = useStore()
  return (
    <main className="page" style={{ maxWidth: 1000 }}>
      <section className="phero"><span className="eyebrow" style={{ color: '#ff8a95' }}>Privacy &amp; security</span><h1>Your business data stays yours</h1>
        <p>Designed around India’s Digital Personal Data Protection Act, 2023: ask first, collect less, keep it shorter, and make it easy to say no.</p></section>

      <div className="grid3 mt">{PRINCIPLES.map(([I, t, d]) => <div key={t} className="card pcard"><I size={26} color="#e11d2e" /><h4>{t}</h4><p className="muted sm" style={{ margin: 0 }}>{d}</p></div>)}</div>

      <section className="card pad mt"><h3>What we collect, why, and for how long</h3>
        <div className="table-wrap"><table className="tbl"><thead><tr><th>Data</th><th>Where</th><th>Why</th><th>Retention</th><th>Consent</th></tr></thead><tbody>
          {TABLE.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 0 ? <b>{c}</b> : c}</td>)}</tr>)}</tbody></table></div></section>

      <section className="grid2e mt">
        <div className="card pad"><h4>Your consent receipt</h4>
          {consent ? <><p className="muted sm">You consented on {consent.ts?.replace('T', ' ')}.</p><div className="totalbar sm"><span>Receipt</span><span className="mono">{consent.id}</span></div><div className="totalbar sm"><span>Notice</span><span>{consent.notice_version}</span></div><div className="totalbar sm"><span>Purposes</span><span>{(consent.purposes || []).join(', ')}</span></div></>
            : <p className="muted">You haven't given consent in this session. When you reach KYC you'll see the notice and get a receipt here.</p>}
          <Link to="/kyc" className="btn ghost sm mt">See the consent screen</Link></div>
        <div className="card pad"><h4>For AI features</h4>
          <p className="muted">The advisor and Scam Shield work offline with transparent rules. If an AI model is switched on for regional-language understanding, we send only the text you typed, never identifiers or documents. Scam Shield text is analysed and not stored.</p></div>
      </section>
      <p className="muted sm mt">This is a prototype built on synthetic data. A production launch would add a registered Data Protection Officer, consent-manager integration and an audit log, as the DPDP Rules require.</p>
    </main>
  )
}

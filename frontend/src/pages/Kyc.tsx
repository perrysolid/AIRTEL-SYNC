/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, FileText, Fingerprint, Lock, ScanLine, ShieldCheck, Upload, X, TriangleAlert, UserRound } from 'lucide-react'
import { api } from '../api'
import { useStore } from '../store'

const PURPOSES = [
  { id: 'kyc', req: true, t: 'Verify my business identity', d: 'We read your GST/Udyam details and match them with government registries. Used only to onboard you.' },
  { id: 'ocr', req: true, t: 'Read the documents I upload', d: 'Text is extracted from your documents on our server; only the fields needed for checks are kept, and IDs are masked on screen and in logs.' },
  { id: 'contact', req: false, t: 'Send order updates on WhatsApp/SMS', d: 'Status messages for this order only. No promotions.' },
  { id: 'marketing', req: false, t: 'Tell me about offers (optional)', d: 'Off by default. You can switch this off any time.' },
]
const DOCS = [['gst', 'GST certificate'], ['udyam', 'Udyam certificate'], ['id', 'Signatory ID'], ['address', 'Address proof (≤ 90 days)']]
const STEPS = ['Consent', 'Business', 'Documents', 'Sign & pay']

export default function Kyc() {
  const { reco, sel, contract, session, kyc, setKyc, consent, setConsent, setOrderId, refreshReco } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(consent ? 1 : 0)
  const [ticks, setTicks] = useState<string[]>(['kyc', 'ocr', 'contact'])
  const [gstin, setGstin] = useState(session?.slots?.gstin || '')
  const [udyam, setUdyam] = useState('')
  const [gRes, setGRes] = useState<any>(null)
  const [uRes, setURes] = useState<any>(null)
  const [contact, setContact] = useState({ name: '', phone: '' })
  const [files, setFiles] = useState<File[]>([])
  const [samples, setSamples] = useState<any[]>([])
  const [sample, setSample] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [signed, setSigned] = useState<any>(null)
  const [pay, setPay] = useState('UPI AutoPay')
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { api('/kyc/samples').then(setSamples).catch(() => setSamples([])) }, [])

  if (!reco) return <main className="page narrow center"><h2>Build your bundle first</h2><Link to="/advisor" className="btn primary mt">Start with Sync</Link></main>

  const items = Object.entries(sel).filter(([, v]) => v.on).map(([product_id, v]) => ({ product_id, qty: v.qty }))
  const needsGst = items.some(i => ['P03', 'P05', 'P06', 'P10', 'P12', 'P13', 'P14', 'P15', 'P21', 'P24'].includes(i.product_id))

  async function agree() {
    const c = await api('/consent', { purposes: ticks, language: session?.lang || 'en' })
    setConsent(c); setStep(1)
  }
  async function lookup() {
    setErr('')
    if (gstin) setGRes(await api('/lookup/gstin', { id: gstin.trim().toUpperCase() }))
    if (udyam) setURes(await api('/lookup/udyam', { id: udyam.trim().toUpperCase() }))
  }
  async function verify() {
    setScanning(true); setKyc(null); setErr('')
    try {
      const t0 = Date.now()
      let r: any
      if (sample) r = await api('/kyc/sample/' + sample)
      else { const fd = new FormData(); files.forEach(f => fd.append('files', f)); if (gstin) fd.append('gstin', gstin); r = await api('/kyc/verify', fd) }
      await new Promise(res => setTimeout(res, Math.max(0, 1800 - (Date.now() - t0))))
      setKyc({ ...r, sample })
    } catch (e: any) { setErr(e.message || 'Could not read the documents') } finally { setScanning(false) }
  }
  async function continueWithoutGst() { await refreshReco({ has_gstin: false }); nav('/quote') }
  async function sendOtp() { await api('/esign/otp', {}); setOtpSent(true) }
  async function doSign() {
    const r = await api('/esign/verify', { id: otp })
    if (r.ok) setSigned(r); else setErr('That OTP is not correct (demo OTP: 123456).')
  }
  async function place() {
    const g = gRes?.found ? gRes : null
    setErr('')
    try {
    const o = await api('/orders', {
      items, contract, consent, session_id: session?.id || null, payment: { method: pay }, kyc: kyc ? { verdict: kyc.verdict } : null,
      customer: { business: g?.trade_name || session?.slots?.business_name || kyc?.business || reco.profile.business_type, name: contact.name, phone: contact.phone,
        gstin: gstin.toUpperCase(), city: reco.profile.city, spend: reco.profile.monthly_spend || 0, esign: signed?.ref,
        sites: reco.profile.sites || 1, employees: reco.profile.employees || 3, segment: reco.segment, pincode: session?.slots?.pincode || '' },
    })
    setOrderId(o.id); nav('/track/' + o.id)
    } catch (e: any) { setErr(typeof e.message === 'string' ? e.message : 'Could not place the order. Please go back to the quote and check your bundle.') }
  }

  const verdict = kyc?.verdict
  const approvedish = verdict === 'approved' || verdict === 'review'
  const canGoOn = approvedish && !(needsGst && kyc?.gst_active === false)

  return (
    <main className="page narrow">
      <span className="eyebrow">Step 3 · Smart KYC</span>
      <h1 style={{ margin: '6px 0 18px', fontSize: 'clamp(24px,3vw,34px)' }}>Verify in minutes, not days</h1>
      <div className="stepper">{STEPS.map((s, i) => <div key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{i < step ? '✓ ' : ''}{s}</div>)}</div>

      {step === 0 && <div className="card pad">
        <div className="row"><ShieldCheck color="#0f9d6b" /><h3>Your data, your choice</h3></div>
        <p className="muted">Under the DPDP Act 2023, we ask first and collect only what each step needs. Tick what you agree to. Required items are needed to verify you; the rest are optional.</p>
        {PURPOSES.map(p => { const on = ticks.includes(p.id); return (
          <div key={p.id} className={'consent-item ' + (on ? 'on' : '')} onClick={() => !p.req && setTicks(on ? ticks.filter(x => x !== p.id) : [...ticks, p.id])}>
            <div className="check">{on && <Check size={14} />}</div>
            <div><b>{p.t}</b> {p.req ? <span className="badge gray">required</span> : <span className="badge blue">optional</span>}<div className="muted sm">{p.d}</div></div></div>) })}
        <div className="assist" style={{ background: 'var(--line2)', color: 'var(--ink2)' }}><Lock size={16} style={{ flex: 'none', marginTop: 3 }} /><span>
          <b>Retention:</b> uploaded documents are deleted 30 days after verification; order records are kept as the law requires. <b>Your rights:</b> withdraw consent, correct or erase your data any time from Track → Privacy. Identifiers are masked (••••1234) everywhere.</span></div>
        <button className="btn primary mt" onClick={agree}>I agree, continue</button>
      </div>}

      {step === 1 && <div className="card pad">
        <h3>Your business</h3>
        <p className="muted">Enter your GSTIN and we fetch your details from the registry. There is no typing of addresses.</p>
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 220 }}><label className="f">GSTIN {needsGst ? '(needed for your bundle)' : '(optional)'}</label><input className="input mono" maxLength={15} value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="15-character GSTIN" /></div>
          <div style={{ flex: 2, minWidth: 220 }}><label className="f">Udyam number (optional)</label><input className="input mono" value={udyam} onChange={e => setUdyam(e.target.value.toUpperCase())} placeholder="UDYAM-XX-00-0000000" /></div>
          <button className="btn dark" onClick={lookup} disabled={!gstin && !udyam}>Look up</button>
        </div>
        {gRes && <div className={'ck ' + (gRes.found && gRes.status === 'Active' && gRes.checksum_ok ? 'pass' : 'fail')} style={{ marginTop: 14 }}>
          <div className="ic">{gRes.found && gRes.status === 'Active' && gRes.checksum_ok ? <Check size={14} /> : <X size={14} />}</div>
          <div>{gRes.found ? <><b>{gRes.trade_name}</b> · {gRes.constitution}<div className="sm muted">{gRes.address}</div><div className="sm">Registered {gRes.registered} · <b>{gRes.status}</b></div></>
            : <b>{!gRes.valid_format ? 'Not a valid GSTIN format' : !gRes.checksum_ok ? 'Check digit mismatch: likely a typo' : 'GSTIN not found in the registry'}</b>}</div></div>}
        {uRes && <div className={'ck ' + (uRes.found ? 'pass' : 'fail')}><div className="ic">{uRes.found ? <Check size={14} /> : <X size={14} />}</div>
          <div>{uRes.found ? <><b>{uRes.enterprise_name}</b> · {uRes.type} enterprise<div className="sm muted">{uRes.nic} · {uRes.city}, {uRes.state}</div></> : <b>Udyam number not found</b>}</div></div>}
        <div className="divider" />
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}><label className="f">Authorised signatory</label><input className="input" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} placeholder="Full name" /></div>
          <div style={{ flex: 1, minWidth: 200 }}><label className="f">WhatsApp number (for updates)</label><input className="input" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} placeholder="+91 98XXXXXX00" /></div>
        </div>
        <div className="row mt"><button className="btn ghost" onClick={() => setStep(0)}>Back</button><button className="btn primary" onClick={() => setStep(2)}>Continue to documents</button></div>
      </div>}

      {step === 2 && <div className="card pad">
        <h3>Upload your documents</h3>
        <p className="muted">Snap or upload. We read them instantly and check them against the registries and against each other.</p>
        <div className={'drop ' + (over ? 'over' : '')} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); setSample(null); setFiles([...files, ...Array.from(e.dataTransfer.files)]) }} onClick={() => input.current?.click()}>
          <Upload /><div><b>Drop images here</b> or tap to choose</div>
          <div className="muted sm">{DOCS.map(d => d[1]).join(' · ')}</div>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { setSample(null); setFiles([...files, ...Array.from(e.target.files || [])]) }} />
        </div>
        {files.length > 0 && <div className="row wrap mt">{files.map((f, i) => <div key={i} style={{ position: 'relative' }}><img className="doc-thumb" src={URL.createObjectURL(f)} alt="" />
          <button className="badge red" style={{ position: 'absolute', top: -6, right: -6 }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></div>)}</div>}
        <div className="divider" />
        <div className="row between wrap"><b>No documents handy? Run a specimen applicant</b><span className="muted sm">synthetic data pack</span></div>
        <div className="mt" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
          {samples.map(s => <button key={s.applicant} className={'sample ' + (sample === s.applicant ? 'on' : '')} onClick={() => { setSample(s.applicant); setFiles([]) }}>
            <span><b>{s.applicant}</b> <span className="sm muted">{s.business}</span></span><FileText size={16} /></button>)}
          {!samples.length && <span className="muted sm">Loading specimens…</span>}
        </div>
        {sample && <div className="row wrap mt">{samples.find(s => s.applicant === sample)?.docs.map((d: string) => <img key={d} className="doc-thumb" src={'/api/kyc/sample-file/' + d} alt={d} />)}</div>}
        {err && <p style={{ color: 'var(--red)', fontWeight: 600 }}>{err}</p>}
        <div className="row mt"><button className="btn ghost" onClick={() => setStep(1)}>Back</button>
          <button className="btn primary" disabled={(!files.length && !sample) || scanning} onClick={verify}><ScanLine size={18} /> {scanning ? 'Reading…' : 'Read & verify'}</button></div>

        {scanning && <div className="card pad mt scan" style={{ background: '#fffdf9' }}><div className="row"><Fingerprint /><b>Reading documents · checking GST and Udyam registries · cross-matching names and addresses…</b></div></div>}

        {kyc && !scanning && <div className="mt">
          <div className={'verdict ' + verdict}>
            <div style={{ fontSize: 34 }}>{verdict === 'approved' ? '✅' : verdict === 'review' ? '⚠️' : '⛔'}</div>
            <div><h3>{verdict === 'approved' ? 'Verified instantly' : verdict === 'review' ? 'Almost there: a few things need a look' : 'We could not verify these documents'}</h3>
              <div className="muted sm">{kyc.passed} checks passed · {kyc.warnings} to review · {kyc.failed} failed</div></div>
          </div>
          {kyc.checks.map((c: any, i: number) => <div key={c.id} className={'ck ' + c.status} style={{ animationDelay: i * 60 + 'ms' }}>
            <div className="ic">{c.status === 'pass' ? <Check size={14} /> : c.status === 'warn' ? '!' : <X size={14} />}</div>
            <div><b>{c.label}</b><div className="sm" style={{ color: 'var(--ink2)' }}>{c.detail}</div></div></div>)}
          <details className="mt"><summary className="muted sm" style={{ cursor: 'pointer' }}>What we extracted (identifiers masked)</summary>
            <pre className="sm mono" style={{ background: 'var(--line2)', padding: 12, borderRadius: 12, overflow: 'auto' }}>{JSON.stringify(kyc.extracted, null, 2)}</pre></details>
          {verdict !== 'approved' && <div className="assist"><UserRound size={16} style={{ flex: 'none', marginTop: 3 }} /><span>Our field partner can resolve this with you in one short call. Your documents and chat are already shared, so nothing is repeated.</span></div>}
          {kyc.gst_active === false && <div className="row wrap mt"><button className="btn dark" onClick={continueWithoutGst}>Continue with GSTIN-free products</button><span className="muted sm">Removes products that need an active GSTIN and keeps the rest.</span></div>}
          <div className="row mt wrap"><button className="btn ghost" onClick={() => { setKyc(null) }}>Try other documents</button>
            {canGoOn && <button className="btn primary" onClick={() => setStep(3)}>{verdict === 'approved' ? 'Continue to sign & pay' : 'Continue (partner will confirm the flagged items)'}</button>}</div>
        </div>}
      </div>}

      {step === 3 && <div className="card pad">
        <h3>Sign &amp; pay</h3>
        <div className="muted sm">Agreement summary</div>
        <div className="card pad mt" style={{ background: 'var(--line2)', boxShadow: 'none' }}>
          {items.map(i => <div key={i.product_id} className="totalbar sm"><span>{i.product_id} × {i.qty}</span><span className="muted">{contract}-month</span></div>)}
          <div className="muted sm mt">I confirm the details are correct and authorise Accel Business to activate the services above on a {contract}-month plan, billed monthly on one invoice. (First invoice shown on the next screen.)</div>
        </div>
        {!signed ? <div className="mt"><label className="f">e-Sign with Aadhaar-style OTP (demo)</label>
          {!otpSent ? <button className="btn dark" onClick={sendOtp}>Send OTP to {contact.phone || 'my number'}</button> :
            <div className="row"><input className="input mono" placeholder="6-digit OTP (demo: 123456)" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} /><button className="btn dark" onClick={doSign} disabled={otp.length < 6}>Sign</button></div>}
          {err && <p style={{ color: 'var(--red)', fontWeight: 600 }}>{err}</p>}</div>
          : <div className="ck pass"><div className="ic"><Check size={14} /></div><div><b>Signed</b><div className="sm muted">Reference {signed.ref}</div></div></div>}
        <div className="mt"><label className="f">Payment (auto-debit monthly)</label>
          <div className="row wrap">{['UPI AutoPay', 'Card', 'Net-banking'].map(m => <button key={m} className={'chip ' + (pay === m ? 'on' : '')} onClick={() => setPay(m)}>{m}</button>)}</div></div>
        <div className="row mt"><button className="btn ghost" onClick={() => setStep(2)}>Back</button>
          <button className="btn primary" disabled={!signed} onClick={place}>Place order <Check size={18} /></button></div>
        {err && signed && <p role="alert" style={{ color: 'var(--red)', fontWeight: 600 }}>{err}</p>}
        <p className="muted sm"><TriangleAlert size={12} /> Demo build: no real payment, OTP or e-sign is performed.</p>
      </div>}
    </main>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageUp, ShieldAlert, ShieldCheck, ShieldQuestion, Send, Phone } from 'lucide-react'
import { api } from '../api'
import { useStore } from '../store'

const EXAMPLES: [string, string][] = [
  ['Fake KYC SMS', 'Dear customer, your Airtel SIM will be blocked today. Update KYC immediately at http://airtel-kyc-update.xyz/verify or call 9876543210'],
  ['Fake UPI screenshot', 'Payment successful Rs 2,400 paid to Raju Kirana UPI Ref 442198 will reflect in your account shortly. Please give the goods now.'],
  ['"Sent by mistake"', 'Sorry bhai I sent Rs 5000 to your number by mistake, please send it back urgently'],
  ['Bill threat + APK', 'Your electricity will be cut tonight. Download app http://bijli-bill.top/pay.apk and pay Rs 10 now'],
  ['Digital arrest', 'This is CBI officer. You are under digital arrest. Install AnyDesk now and do not tell anyone'],
  ['Hindi KYC', 'आपका खाता बंद हो जाएगा। तुरंत केवाईसी अपडेट करें और ओटीपी बताओ'],
  ['A normal message', 'Hi, are we meeting at 5 pm for the supplier visit tomorrow?'],
]
const ICON: Record<string, any> = { scam: ShieldAlert, suspicious: ShieldQuestion, clear: ShieldCheck }
const COLOR: Record<string, string> = { scam: '#e11d2e', suspicious: '#d98a05', clear: '#0f9d6b' }

export default function Shield() {
  const { lang } = useStore()
  const [text, setText] = useState('')
  const [res, setRes] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const l = lang === 'hi' ? 'hi' : 'en'

  async function check(t = text) {
    if (!t.trim()) return
    setBusy(true); setErr('')
    try { setRes(await api('/scam/check', { text: t, lang: l })) } catch { setErr('Could not check that right now. Please try again.') } finally { setBusy(false) }
  }
  async function upload(f: File) {
    setBusy(true); setErr('')
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('lang', l)
      const r = await api('/scam/check-image', fd)
      setRes(r); if (r.ocr_text) setText(r.ocr_text)
    } catch { setErr('I could not read that picture. Try a clearer screenshot, or paste the text.') } finally { setBusy(false) }
  }
  const V = res ? ICON[res.verdict] : null
  return (
    <main className="page narrow">
      <section className="shield-hero">
        <span className="eyebrow" style={{ color: '#ff8a95' }}>SYNC Scam Shield · free for everyone</span>
        <h1 style={{ fontSize: 'clamp(28px,4vw,42px)', margin: '8px 0 10px' }}>Got a message that feels wrong? Check it here.</h1>
        <p>Paste a message or link, or upload a screenshot. I'll tell you what looks suspicious, in plain words, and exactly what to do next. Your text is analysed on our server and not stored.</p>
      </section>

      <div className="card pad mt">
        <label className="f" htmlFor="msg">Paste the message, link or number</label>
        <textarea id="msg" className="input" rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. 'Your SIM will be blocked. Update KYC at http://…'" style={{ resize: 'vertical' }} />
        <div className="row wrap mt" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={!text.trim() || busy} onClick={() => check()}><Send size={18} /> {busy ? 'Checking…' : 'Check it'}</button>
          <button className="btn ghost" disabled={busy} onClick={() => file.current?.click()}><ImageUp size={18} /> Upload a screenshot</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <div className="muted sm mt">Try an example:</div>
        <div className="row wrap" style={{ marginTop: 6 }}>{EXAMPLES.map(([k, v]) => <button key={k} className="chip sm" onClick={() => { setText(v); check(v) }}>{k}</button>)}</div>
        {err && <p style={{ color: 'var(--red)', fontWeight: 600 }}>{err}</p>}
      </div>

      {res && V && <div className="mt" aria-live="polite">
        <div className={'verdict-card ' + res.verdict}>
          <V size={44} color={COLOR[res.verdict]} style={{ flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 28 }}>{res.label}</h2><p style={{ margin: '4px 0 0', fontWeight: 600 }}>{res.advice}</p>
            <div className="meter" role="img" aria-label={`Risk ${res.score} out of 100`}><i style={{ width: res.score + '%', background: COLOR[res.verdict] }} /></div>
            <div className="muted sm">Risk score {res.score}/100</div>
          </div>
        </div>

        {res.reasons.length > 0 && <div className="card pad mt"><h4>Why I think so</h4>
          {res.reasons.map((r: any, i: number) => <div className="reason" key={i}><span className={'dotk dot-' + r.severity} /><span>{r.text}</span></div>)}
          {res.links.length > 0 && <div className="mt"><span className="muted sm">Links found:</span><div className="row wrap" style={{ marginTop: 6 }}>{res.links.map((k: any) => <span className="link-chip" key={k.url}>🔗 {k.host}</span>)}</div></div>}
        </div>}

        <div className="card pad mt"><h4>What to do now</h4>
          <ol className="step-list">{res.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ol>
          {res.verdict !== 'clear' && <div className="row wrap mt">
            <a className="btn dark sm" href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer">Report on Chakshu</a>
            <a className="btn ghost sm" href="tel:1930"><Phone size={14} /> Lost money? Call 1930</a>
          </div>}
        </div>
      </div>}

      <div className="card pad mt"><b>Prefer WhatsApp?</b>
        <p className="muted" style={{ margin: '6px 0 12px' }}>Forward any suspicious message or screenshot to the SYNC number and get the same answer in your chat, in Hindi or English.</p>
        <Link to="/whatsapp" className="btn ghost sm">Try it on WhatsApp</Link></div>
      <p className="muted sm mt">Scam Shield looks for known red flags. It cannot prove a message is safe or confirm that a payment arrived. When in doubt, check inside your bank/UPI app and never share an OTP.</p>
    </main>
  )
}

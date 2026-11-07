/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { api } from '../api'

type M = { from: 'in' | 'out'; text: string; img?: string }
type Q = { label: string; send: string }
const fmt = (t: string) => t.split(/(\*[^*]+\*)/g).map((p, i) => p.startsWith('*') && p.endsWith('*') ? <b key={i}>{p.slice(1, -1)}</b> : <span key={i}>{p}</span>)
const KNOWN_PHONE = '+919811100001'

const FEATURES: [string, string][] = [
  ['🛒 Buy & KYC', 'Answer 6 questions, send document photos, e-sign: all in this chat.'],
  ['🛡️ Scam Shield', 'Forward a suspicious message or screenshot and get a verdict.'],
  ['📡 Network check', 'Type NETWORK 411016 Pune to see what can be installed.'],
  ['📅 Install slot', 'SCHEDULE / RESCHEDULE: pick a time without calling.'],
  ['🔧 Troubleshooter', 'TROUBLE: slow or no internet gets diagnosed and ticketed.'],
  ['🏪 Branch-in-a-Box', 'BRANCH: copy your setup to a new location.'],
  ['🔔 Lead rescue', 'Left mid-purchase? SYNC nudges you with the exact next step.'],
]

export default function WhatsApp() {
  const [phone] = useState(KNOWN_PHONE)
  const [msgs, setMsgs] = useState<M[]>([])
  const [quick, setQuick] = useState<Q[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length, quick.length])

  async function deliver(replies: { text: string; quick: Q[] }[]) {
    for (const r of replies) { await new Promise(res => setTimeout(res, 380)); setMsgs(m => [...m, { from: 'in', text: r.text }]) }
    setQuick(replies.length ? replies[replies.length - 1].quick : [])
  }
  async function send(t: string, shown?: string) {
    if (!t.trim() || busy) return
    setText(''); setQuick([]); setMsgs(m => [...m, { from: 'out', text: shown ?? t }]); setBusy(true)
    try { await deliver((await api('/whatsapp/sim', { phone, text: t })).replies) } finally { setBusy(false) }
  }
  async function sendImage(f: File) {
    if (busy) return
    setQuick([]); setMsgs(m => [...m, { from: 'out', text: '📷 ' + f.name, img: URL.createObjectURL(f) }]); setBusy(true)
    try { const fd = new FormData(); fd.append('phone', phone); fd.append('file', f); await deliver((await api('/whatsapp/sim-image', fd)).replies) } finally { setBusy(false) }
  }
  async function nudge() {
    setBusy(true); setQuick([])
    try { await deliver((await api('/whatsapp/nudge', { phone })).replies) } finally { setBusy(false) }
  }
  return (
    <main className="page">
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div>
          <span className="eyebrow">SYNC on WhatsApp</span>
          <h1 style={{ margin: '6px 0 12px', fontSize: 'clamp(26px,3.4vw,38px)' }}>One chat for the whole customer lifecycle</h1>
          <p className="muted">Small businesses already live on WhatsApp. Say <b>Hi</b> and everything works in the chat: buy, verify KYC with photos, book installation, track, fix problems, open a branch, and check scams. Same rules, same catalogue, same consent.</p>
          <div className="row wrap mt">
            <button className="btn primary" onClick={() => send('Hi')}>Start: say “Hi”</button>
            <button className="btn ghost" onClick={nudge}>🔔 Simulate a lead-rescue nudge</button>
            <button className="btn ghost" onClick={() => { setMsgs([]); setQuick([]); api('/whatsapp/sim', { phone, text: 'RESET' }) }}>Clear chat</button>
          </div>
          <div className="card pad mt"><b>What it can do</b>
            {FEATURES.map(([a, b]) => <div key={a} className="bundle-line" style={{ padding: '10px 0' }}><div style={{ flex: 1 }}><b>{a}</b><div className="muted sm">{b}</div></div></div>)}</div>
          <div className="card pad mt"><b>Hands-on shortcuts</b>
            <div className="row wrap mt" style={{ marginTop: 8 }}>{['STATUS', 'SCHEDULE', 'TROUBLE', 'BRANCH', 'NETWORK 411016 Pune', 'SHIELD', 'नमस्ते'].map(x => <button key={x} className="chip sm" onClick={() => send(x)}>{x}</button>)}</div>
            <p className="muted sm">Use 📎 to send a screenshot to Scam Shield, or a document photo during KYC. Numbered replies work too. Hands off to a local partner when you ask for a person.</p></div>
          <div className="card pad mt"><b>Go live in 2 steps</b>
            <ol className="muted sm" style={{ paddingLeft: 18 }}>
              <li>Point a Twilio / Meta WhatsApp webhook at <span className="mono">POST /api/whatsapp/webhook</span>.</li>
              <li>Optionally set <span className="mono">ANTHROPIC_API_KEY</span> for free text in regional languages (offline mode is built in).</li>
            </ol></div>
        </div>
        <div className="phone"><div className="phone-in">
          <div className="wa-head"><div className="avatar" style={{ width: 36, height: 36 }}>A</div><div><b>Accel Business</b><div style={{ fontSize: 12, opacity: .8 }}>Verified business · online</div></div></div>
          <div className="wa-body" aria-live="polite">{msgs.length === 0 && <div className="wa-b in" style={{ alignSelf: 'center', background: '#fff8d6' }}>Send “Hi” to start. You are {phone}.</div>}
            {msgs.map((m, i) => <div key={i} className={'wa-b ' + m.from}>{m.img && <img src={m.img} alt="" />}{fmt(m.text)}</div>)}
            {busy && <div className="wa-b in typing"><span /><span /><span /></div>}<div ref={end} /></div>
          {quick.length > 0 && <div className="wa-quick">{quick.slice(0, 8).map(q => <button key={q.send + q.label} onClick={() => send(q.send, q.label)}>{q.label}</button>)}</div>}
          <div className="wa-in">
            <button className="wa-attach" aria-label="Attach photo" onClick={() => file.current?.click()}><Paperclip size={18} /></button>
            <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }} />
            <input aria-label="Message" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(text)} placeholder="Message" />
            <button className="wa-send" aria-label="Send" onClick={() => send(text)}><Send size={18} /></button>
          </div>
        </div></div>
      </div>
    </main>
  )
}

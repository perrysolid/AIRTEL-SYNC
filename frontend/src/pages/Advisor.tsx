/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mic, Send, Volume2, VolumeX, UserRound, Sparkles, Lock } from 'lucide-react'
import { CAT_ICON, LANGS, SPEECH, api, inr } from '../api'
import { selFromReco, useStore } from '../store'

export default function Advisor() {
  const { lang, setLang, session, setSession, setReco, setSel } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [rec, setRec] = useState(false)
  const [speak, setSpeak] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const msgs: any[] = session?.messages || []
  const lastMsg = msgs[msgs.length - 1]
  const reco = session?.reco
  const stage = session?.stage

  useEffect(() => { if (!session?.id || session.lang !== lang) start() /* eslint-disable-next-line */ }, [])
  useEffect(() => { if (session?.id && session.lang !== lang) start(lang) /* eslint-disable-next-line */ }, [lang])
  useEffect(() => {
    if (sp.get('human') === '1' && session?.id && stage !== 'handoff') { setSp({}); send('I want to talk to a person', '__human__') }
    // eslint-disable-next-line
  }, [session?.id])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length, busy])
  useEffect(() => {
    if (reco) { setReco(reco); setSel(selFromReco(reco)) }
    // eslint-disable-next-line
  }, [reco?.quote?.monthly_total])

  async function start(l = lang) {
    setBusy(true)
    try { const s = await api('/advisor/start', { lang: l, channel: 'web' }); setSession(s); setPicked([]) } finally { setBusy(false) }
  }
  async function send(t: string, value?: string) {
    if (!session?.id || busy || (!t.trim() && !value)) return
    setText(''); setPicked([])
    setSession({ ...session, messages: [...msgs, { role: 'user', text: t }] })
    setBusy(true)
    try {
      let s: any
      try { s = await api('/advisor/message', { session_id: session.id, text: t, value }) }
      catch (e: any) {
        if (e.status !== 404) throw e
        const fresh = await api('/advisor/start', { lang, channel: 'web' })   // server restarted: begin again, politely
        setSession({ ...fresh, messages: [...fresh.messages, { role: 'advisor', text: 'Sorry, I lost our chat after an update. Let us start again.' }] }); return
      }
      setSession(s)
      const m = s.messages[s.messages.length - 1]
      if (speak && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(m.text); u.lang = SPEECH[lang] || 'en-IN'; speechSynthesis.speak(u) }
    } finally { setBusy(false) }
  }
  function mic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input needs Chrome or Edge.'); return }
    const r = new SR(); r.lang = SPEECH[lang] || 'en-IN'; r.interimResults = false
    r.onstart = () => setRec(true); r.onend = () => setRec(false)
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setText(t); send(t) }
    r.start()
  }
  const q = reco?.quote
  const showChips = lastMsg?.role === 'advisor' && lastMsg.chips && stage !== 'done_reco' && stage !== 'handoff' && !busy

  return (
    <main className="page">
      <h1 className="sr-only">Sync, your business advisor</h1>
      <div className="grid2">
        <section className="card chat">
          <div className="chat-head">
            <div className="avatar">S</div>
            <div style={{ flex: 1 }}><b>Sync</b><div className="muted sm">Accel Business advisor</div></div>
            <select aria-label="Chat language" className="input" style={{ width: 'auto', padding: '6px 10px' }} value={lang} onChange={e => { setLang(e.target.value); start(e.target.value) }}>
              {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="mic" title="Read replies aloud" onClick={() => setSpeak(!speak)}>{speak ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          </div>
          <div className="msgs">
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className={'bub ' + m.role} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>{m.text}</div>
                {m.reco && <div className="row mt" style={{ alignSelf: 'flex-start' }}><button className="btn primary sm" onClick={() => nav('/quote')}>Open my quote →</button></div>}
              </div>))}
            {showChips && (
              <div className="chips">
                {lastMsg.chips.options.map((o: any) => {
                  const on = picked.includes(o.value)
                  return <button key={o.value} className={'chip ' + (on ? 'on' : '')} onClick={() => lastMsg.chips.multi ? setPicked(on ? picked.filter(x => x !== o.value) : [...picked, o.value]) : send(o.label, o.value)}>{o.label}</button>
                })}
                {lastMsg.chips.multi && <button className="btn dark sm" onClick={() => send(picked.length ? picked.join(', ') : 'done', picked.length ? undefined : '__done__')}>{picked.length ? `Continue (${picked.length})` : lastMsg.chips.extra[0].label}</button>}
              </div>)}
            {busy && <div className="bub advisor typing"><span /><span /><span /></div>}
            <div ref={end} />
          </div>
          <div className="composer">
            <button className={'mic ' + (rec ? 'rec' : '')} onClick={mic} title="Speak"><Mic size={20} /></button>
            <input className="input" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(text)} placeholder={lang === 'hi' ? 'अपना जवाब लिखें या बोलें…' : 'Type or speak your answer…'} />
            <button className="btn primary" onClick={() => send(text)} aria-label="Send"><Send size={18} /></button>
          </div>
          <div className="row between" style={{ padding: '0 14px 12px' }}>
            <button className="btn ghost sm" onClick={() => send('I want to talk to a person', '__human__')}><UserRound size={14} /> Talk to a person</button>
            <button className="btn ghost sm" onClick={() => start()}>Restart</button>
          </div>
        </section>

        <aside className="sticky">
          <div className="card pad">
            <div className="row between"><span className="eyebrow">Your bundle, live</span>{reco && <span className="badge green">{reco.segment_name}</span>}</div>
            {!reco && <div className="muted mt" style={{ minHeight: 160 }}><Sparkles size={22} /><p>Answer a few questions and your personalised bundle builds itself here, with plain-language reasons and one monthly price.</p>
              <div className="skel" style={{ height: 14, margin: '8px 0', width: '80%' }} /><div className="skel" style={{ height: 14, width: '60%' }} /></div>}
            {reco && q && <>
              <div className="mt"><div className="price big">{inr(q.monthly_total)}<span className="muted sm" style={{ fontWeight: 600 }}> /month incl. GST</span></div>
                <div className="muted sm">One-time setup {inr(q.setup_total)} · {q.contract_months}-month plan · one bill{q.bundle_discount_pct ? ` · ${q.bundle_discount_pct}% bundle saving` : ''}</div></div>
              <div className="mt">{reco.items.filter((i: any) => i.selected).map((i: any) => {
                const l = q.lines.find((x: any) => x.product_id === i.product_id)
                return l && <div key={i.product_id} className="bundle-line"><div className="cat-icon">{CAT_ICON[l.category]}</div>
                  <div style={{ flex: 1 }}><b>{l.name}</b> <span className="muted sm">× {l.qty} {l.unit}</span><div className="muted sm">{i.reason}</div></div><b>{inr(l.monthly)}</b></div>
              })}</div>
              {reco.locked.length > 0 && <div className="assist" style={{ background: 'var(--amber-soft)', color: '#8a5a00' }}><Lock size={16} style={{ flex: 'none', marginTop: 3 }} />
                <span>{reco.locked.length} more product{reco.locked.length > 1 ? 's' : ''} (e.g. {reco.locked[0].name}) unlock with a GSTIN. You can add it on the next screen.</span></div>}
              {reco.assist.map((a: string) => <div key={a} className="assist"><UserRound size={16} style={{ flex: 'none', marginTop: 3 }} /><span>{a}</span></div>)}
              <button className="btn primary mt" style={{ width: '100%' }} onClick={() => nav('/quote')}>Customise &amp; checkout →</button>
            </>}
          </div>
          <p className="muted sm center mt">Catalogue-aware rules engine, optionally enhanced by Claude. Your answers stay private until you buy.</p>
        </aside>
      </div>
    </main>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'

export type Sel = Record<string, { qty: number; on: boolean }>
type Ctx = {
  lang: string; setLang: (l: string) => void
  session: any; setSession: (s: any) => void
  reco: any; setReco: (r: any) => void
  sel: Sel; setSel: (s: Sel) => void
  contract: number; setContract: (c: number) => void
  kyc: any; setKyc: (k: any) => void
  consent: any; setConsent: (c: any) => void
  orderId: string | null; setOrderId: (o: string | null) => void
  profile: () => any
  refreshReco: (over?: any) => Promise<void>
  reset: () => void
}
const C = createContext<Ctx>(null as any)
export const useStore = () => useContext(C)

function load<T>(k: string, d: T): T { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
export function selFromReco(reco: any, prev?: Sel): Sel {
  const s: Sel = {}
  for (const it of reco?.items || []) s[it.product_id] = prev?.[it.product_id] ?? { qty: it.qty, on: it.selected }
  return s
}

export function Store({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<string>(() => load('lang', 'en'))
  const [session, setSession] = useState<any>(() => load('session', null))
  const [reco, setReco] = useState<any>(() => load('reco', null))
  const [sel, setSel] = useState<Sel>(() => load('sel', {}))
  const [contract, setContract] = useState<number>(() => load('contract', 12))
  const [kyc, setKyc] = useState<any>(() => load('kyc', null))
  const [consent, setConsent] = useState<any>(() => load('consent', null))
  const [orderId, setOrderId] = useState<string | null>(() => load('orderId', null))
  useEffect(() => {
    const st: Record<string, unknown> = { lang, session, reco, sel, contract, kyc, consent, orderId }
    for (const [k, v] of Object.entries(st)) { try { sessionStorage.setItem(k, JSON.stringify(v)) } catch { /* quota */ } }
  }, [lang, session, reco, sel, contract, kyc, consent, orderId])

  const profile = useCallback(() => {
    const sl = session?.slots || {}
    const p = reco?.profile || {}
    return {
      business_type: sl.business_type || p.business_type || 'Kirana store', city: sl.city || p.city || 'Pune',
      employees: sl.employees || p.employees || 3, sites: sl.sites || p.sites || 1,
      has_gstin: !!(sl.has_gstin ?? p.has_gstin), current_internet: sl.current_internet || p.current_internet || '',
      spend: sl.spend || p.monthly_spend || 0, needs: session?.needs || p.needs || [], force_conn: p.force_conn || '',
    }
  }, [session, reco])

  const refreshReco = useCallback(async (over: any = {}) => {
    const r = await api('/recommend', { ...profile(), ...over })
    setReco(r)
    setSel(prev => selFromReco(r, prev))
  }, [profile])

  const reset = () => {
    // start a fresh quote: keep the placed order so 'My service' keeps working, but a NEW purchase must show the consent notice again
    for (const k of ['session', 'reco', 'sel', 'kyc', 'contract', 'consent']) { try { sessionStorage.removeItem(k) } catch { /* ignore */ } }
    setSession(null); setReco(null); setSel({}); setKyc(null); setConsent(null); setContract(12)
  }
  const v = useMemo(() => ({ lang, setLang, session, setSession, reco, setReco, sel, setSel, contract, setContract, kyc, setKyc, consent, setConsent, orderId, setOrderId, profile, refreshReco, reset }),
    [lang, session, reco, sel, contract, kyc, consent, orderId, profile, refreshReco])
  return <C.Provider value={v}>{children}</C.Provider>
}

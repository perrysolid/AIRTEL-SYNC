/* eslint-disable @typescript-eslint/no-explicit-any */
export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch('/api' + path, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  })
  if (!r.ok) {
    let d: any = null
    try { d = await r.json() } catch { /* ignore */ }
    throw Object.assign(new Error(d?.detail?.error || d?.detail || r.statusText), { status: r.status, detail: d?.detail })
  }
  return r.json()
}
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
export const CAT_ICON: Record<string, string> = { Connectivity: '📶', Communication: '💬', 'Cloud & Productivity': '☁️', Security: '🛡️', 'IoT & Physical': '📹' }
export const LANGS: Record<string, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు', bn: 'বাংলা', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ' }
export const SPEECH: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN' }

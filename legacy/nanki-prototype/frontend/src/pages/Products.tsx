/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { CAT_ICON, api, inr } from '../api'

const CATS = ['All', 'Connectivity', 'Communication', 'Cloud & Productivity', 'Security', 'IoT & Physical']
const SEG: Record<string, string> = { micro: 'Micro', prof: 'Professional', multi: 'Multi-site', mfg: 'Manufacturing' }

export default function Products() {
  const [data, setData] = useState<any[]>([])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [noGst, setNoGst] = useState(false)
  const [maxPrice, setMaxPrice] = useState(0)
  const [sort, setSort] = useState('cat')
  useEffect(() => { api('/catalogue').then(r => setData(r.products)).catch(() => {}) }, [])
  const rows = useMemo(() => {
    let r = data.filter(p => (cat === 'All' || p.category === cat) && (!noGst || p.requires_gstin !== 'Y') && (!maxPrice || p.price_min_inr_per_month <= maxPrice)
      && (!q || (p.product_name + p.description + p.category).toLowerCase().includes(q.toLowerCase())))
    if (sort === 'price') r = [...r].sort((a, b) => a.price_min_inr_per_month - b.price_min_inr_per_month)
    if (sort === 'install') r = [...r].sort((a, b) => a.typical_install_days - b.typical_install_days)
    return r
  }, [data, cat, q, noGst, maxPrice, sort])
  return (
    <main className="page">
      <section className="phero"><span className="eyebrow" style={{ color: '#ff8a95' }}>Products</span><h1>Everything a small business needs, in one catalogue</h1>
        <p>25 products across connectivity, communication, cloud, security and IoT. Each shows its real price range, contract, setup fee, install time and eligibility rules.</p></section>

      <div className="card pad mt">
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="search" style={{ flex: 2, minWidth: 220 }}><Search size={18} /><input aria-label="Search products" className="input" placeholder="Search: fibre, WhatsApp, CCTV…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div style={{ minWidth: 170 }}><label className="f" htmlFor="mp">Starting price up to</label>
            <select id="mp" className="input" value={maxPrice} onChange={e => setMaxPrice(+e.target.value)}><option value={0}>Any</option><option value={500}>₹500/mo</option><option value={1000}>₹1,000/mo</option><option value={2500}>₹2,500/mo</option><option value={5000}>₹5,000/mo</option></select></div>
          <div style={{ minWidth: 150 }}><label className="f" htmlFor="so">Sort by</label>
            <select id="so" className="input" value={sort} onChange={e => setSort(e.target.value)}><option value="cat">Category</option><option value="price">Lowest price</option><option value="install">Fastest install</option></select></div>
          <label className="row" style={{ fontWeight: 600, minHeight: 48 }}><input type="checkbox" checked={noGst} onChange={e => setNoGst(e.target.checked)} /> No GSTIN needed</label>
        </div>
        <div className="row wrap mt" style={{ marginTop: 14 }}>{CATS.map(c => <button key={c} className={'chip ' + (cat === c ? 'on' : '')} onClick={() => setCat(c)}>{c !== 'All' && CAT_ICON[c]} {c}</button>)}</div>
      </div>

      <p className="muted sm mt">{rows.length} product{rows.length === 1 ? '' : 's'}</p>
      <div className="grid3">
        {rows.map(p => {
          const deps = String(p.requires_one_of || '').split('|').filter(Boolean)
          return (
            <div key={p.product_id} className="card pcard">
              <div className="row between"><span style={{ fontSize: 26 }}>{CAT_ICON[p.category]}</span><span className="tag">{p.product_id}</span></div>
              <h4>{p.product_name}</h4><p className="muted sm" style={{ margin: 0 }}>{p.description}</p>
              <div className="price">{inr(p.price_min_inr_per_month)}{p.price_max_inr_per_month > p.price_min_inr_per_month ? ` – ${inr(p.price_max_inr_per_month)}` : ''}<span className="muted sm" style={{ fontWeight: 600 }}> {p.unit}/mo</span></div>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="tag">{p.min_contract_months}-month min</span><span className="tag">Setup {inr(p.one_time_setup_inr)}</span><span className="tag">Live ~{p.typical_install_days}d</span>
                {p.requires_gstin === 'Y' ? <span className="badge amber">GSTIN needed</span> : <span className="badge green">No GSTIN</span>}
                {deps.length > 0 && <span className="badge blue">Needs a connectivity plan</span>}
                {p.min_employees > 1 && <span className="badge gray">{p.min_employees}+ people</span>}{p.min_sites > 1 && <span className="badge gray">{p.min_sites}+ sites</span>}
                {String(p.available_city_tiers) === '1' && <span className="badge gray">Tier-1 only</span>}
              </div>
              <div className="muted sm">For: {String(p.target_segments).split(';').map((s: string) => SEG[s] || s).join(' · ')}</div>
            </div>)
        })}
      </div>
      {rows.length === 0 && <div className="card pad center mt muted">No products match. Try clearing a filter.</div>}
      <div className="card pad mt center"><b>Not sure what you need?</b><p className="muted">Sync recommends the right products and checks eligibility for you.</p><Link to="/advisor" className="btn primary">Ask the advisor</Link></div>
    </main>
  )
}

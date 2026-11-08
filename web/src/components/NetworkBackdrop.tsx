/**
 * Landing hero backdrop: a glowing globe-and-network photograph, with a live layer of nodes and links on top. Light
 * pulses travel along the links, nodes twinkle and a few send out signal rings. Generated from a fixed seed so the
 * server and the client draw the same picture.
 */

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1600;
const H = 900;

export function NetworkBackdrop({ className = "" }: { className?: string }) {
  const r = rng(2026);
  // nodes on a jittered grid, so they spread evenly instead of clumping
  const nodes: { x: number; y: number; s: number; hot: boolean }[] = [];
  const cols = 9;
  const rows = 5;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      nodes.push({
        x: ((i + 0.15 + r() * 0.7) / cols) * W,
        y: ((j + 0.15 + r() * 0.7) / rows) * H,
        s: 1.8 + r() * 2.4,
        hot: r() > 0.86,
      });
    }
  }
  // link each node to its two nearest neighbours (once per pair)
  const seen = new Set<string>();
  const links: { d: string; len: number }[] = [];
  nodes.forEach((n, i) => {
    nodes
      .map((m, k) => ({ k, dist: Math.hypot(m.x - n.x, m.y - n.y) }))
      .filter((o) => o.k !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2)
      .forEach(({ k, dist }) => {
        const key = i < k ? `${i}-${k}` : `${k}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        const m = nodes[k];
        links.push({ d: `M${n.x.toFixed(1)} ${n.y.toFixed(1)}L${m.x.toFixed(1)} ${m.y.toFixed(1)}`, len: dist });
      });
  });

  return (
    <div aria-hidden className={`overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero/network.jpg" alt="" className="net-drift absolute inset-0 h-full w-full object-cover" />
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nb-halo">
            <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g stroke="#9fc6ff" strokeOpacity="0.22" strokeWidth="1" fill="none">
          {links.map((l, i) => <path key={i} d={l.d} />)}
        </g>
        {/* travelling light pulses */}
        <g fill="none" strokeLinecap="round" strokeWidth="2.2">
          {links.map((l, i) =>
            i % 3 === 0 ? (
              <path key={i} d={l.d} pathLength={100} stroke={i % 6 === 0 ? "#ff8a8a" : "#ffe2b8"} className="net-pulse" style={{ animationDelay: `${(i % 9) * -0.9}s`, animationDuration: `${3.2 + (i % 5) * 0.6}s` }} />
            ) : null,
          )}
        </g>
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.s * 5} fill="url(#nb-halo)" opacity={n.hot ? 0.7 : 0.35} className={i % 4 === 0 ? "twinkle" : undefined} style={i % 4 === 0 ? { animationDelay: `${(i % 7) * 0.5}s` } : undefined} />
            <circle cx={n.x} cy={n.y} r={n.s} fill={n.hot ? "#ff5a5a" : "#fff1d6"} />
            {n.hot && <circle cx={n.x} cy={n.y} r="12" fill="none" stroke="#ff6b6b" strokeWidth="1.4" className="ring" style={{ animationDelay: `${(i % 5) * 0.8}s` }} />}
          </g>
        ))}
      </svg>
    </div>
  );
}

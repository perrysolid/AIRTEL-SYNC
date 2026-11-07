/**
 * Night-city backdrop for the landing hero: layered skylines with lit windows, a telecom tower, and glowing red links
 * arcing between rooftops, each labelled with a service a small business runs on (UPI, CCTV, WhatsApp...).
 * Pure SVG generated from a fixed seed, so server and client render exactly the same picture.
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

interface Building {
  x: number;
  w: number;
  top: number;
  roof: "flat" | "mast" | "step";
}

function skyline(seed: number, base: number, minW: number, maxW: number, minH: number, maxH: number): Building[] {
  const r = rng(seed);
  const out: Building[] = [];
  let x = -30;
  while (x < 1640) {
    const w = minW + r() * (maxW - minW);
    const h = minH + r() * (maxH - minH);
    const roll = r();
    out.push({ x, w, top: base - h, roof: roll > 0.82 ? "mast" : roll > 0.64 ? "step" : "flat" });
    x += w + 2 + r() * 6;
  }
  return out;
}

/** Window grid for one building as two paths (warm white and a few brand-red), so each building is a handful of elements. */
function windows(b: Building, base: number, density: number, r: () => number) {
  let warm = "";
  let red = "";
  const cols = Math.floor((b.w - 8) / 9);
  const rows = Math.floor((base - b.top - 14) / 12);
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) {
      if (r() > density) continue;
      const cell = `M${(b.x + 4 + c * 9).toFixed(1)} ${(b.top + 9 + k * 12).toFixed(1)}h3.4v5h-3.4z`;
      if (r() < 0.14) red += cell;
      else warm += cell;
    }
  }
  return { warm, red };
}

const roofPath = (b: Building, base: number) => {
  const cx = b.x + b.w / 2;
  if (b.roof === "mast") return `M${b.x} ${base}V${b.top}H${b.x + b.w}V${base}ZM${cx - 0.8} ${b.top}V${b.top - 26}h1.6V${b.top}Z`;
  if (b.roof === "step") return `M${b.x} ${base}V${b.top + 14}H${b.x + 6}V${b.top}H${b.x + b.w - 6}V${b.top + 14}H${b.x + b.w}V${base}Z`;
  return `M${b.x} ${base}V${b.top}H${b.x + b.w}V${base}Z`;
};

const NODE_TARGETS: [number, string][] = [
  [110, "UPI"],
  [375, "CCTV"],
  [1010, "POS"],
  [1175, "WhatsApp"],
  [1525, "Billing"],
];

export function HeroScene({ className = "" }: { className?: string }) {
  const stars = (() => {
    const r = rng(7);
    return Array.from({ length: 70 }, () => ({ x: r() * 1600, y: r() * 360, o: 0.25 + r() * 0.6, s: 0.6 + r() * 1.2 }));
  })();

  const far = skyline(11, 650, 38, 70, 90, 250);
  const mid = skyline(23, 735, 44, 86, 120, 300);
  const near = skyline(37, 805, 56, 120, 150, 330);

  const wr = rng(99);
  const midWin = mid.map((b) => windows(b, 735, 0.22, wr));
  const nearWin = near.map((b) => windows(b, 805, 0.34, wr));

  // rooftop nodes: the near building closest to each target x
  const nodes = NODE_TARGETS.map(([tx, label]) => {
    const b = near.reduce((best, c) => (Math.abs(c.x + c.w / 2 - tx) < Math.abs(best.x + best.w / 2 - tx) ? c : best));
    return { x: b.x + b.w / 2, y: b.top - (b.roof === "mast" ? 26 : 0) - 6, label };
  });
  const tower = { x: 1290, y: 232 };
  const chain = [nodes[0], nodes[1], nodes[2], nodes[3], tower, nodes[4]];
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }, lift = 0.32) => {
    const cx = (a.x + b.x) / 2;
    const cy = Math.min(a.y, b.y) - Math.hypot(b.x - a.x, b.y - a.y) * lift;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };
  const arcs = [
    ...chain.slice(0, -1).map((p, i) => arc(p, chain[i + 1])),
    arc(tower, nodes[0], 0.42), // one long sky link back across the whole city
    arc(tower, nodes[2], 0.5),
  ];

  // tower lattice
  const legs = [
    `M1254 805L${tower.x - 4} ${tower.y}`,
    `M1326 805L${tower.x + 4} ${tower.y}`,
  ];
  const braces: string[] = [];
  for (let i = 0; i < 16; i++) {
    const t0 = i / 16;
    const t1 = (i + 1) / 16;
    const y0 = 805 + (tower.y - 805) * t0;
    const y1 = 805 + (tower.y - 805) * t1;
    const half0 = 36 - 32 * t0;
    const half1 = 36 - 32 * t1;
    braces.push(i % 2 ? `M${1290 - half0} ${y0}L${1290 + half1} ${y1}` : `M${1290 + half0} ${y0}L${1290 - half1} ${y1}`);
  }

  return (
    <svg className={className} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A city at night, its businesses linked by a glowing network" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04060f" />
          <stop offset="0.45" stopColor="#0b1030" />
          <stop offset="0.8" stopColor="#2a0b1f" />
          <stop offset="1" stopColor="#5a0a14" />
        </linearGradient>
        <radialGradient id="hs-glow" cx="0.28" cy="0.86" r="0.7">
          <stop offset="0" stopColor="#e40000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#e40000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hs-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12040a" />
          <stop offset="1" stopColor="#040208" />
        </linearGradient>
        <filter id="hs-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width="1600" height="900" fill="url(#hs-sky)" />
      <rect width="1600" height="900" fill="url(#hs-glow)" />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} className={i % 5 === 0 ? "twinkle" : undefined} style={i % 5 === 0 ? { animationDelay: `${(i % 7) * 0.6}s` } : undefined} />
      ))}

      {/* far, mid and near skylines */}
      <g fill="#1a1236" opacity="0.8">{far.map((b, i) => <path key={i} d={roofPath(b, 650)} />)}</g>
      <g fill="#0d1030">
        {mid.map((b, i) => <path key={i} d={roofPath(b, 735)} />)}
        {midWin.map((w, i) => (
          <g key={i}>
            <path d={w.warm} fill="#ffd9a6" opacity="0.55" />
            <path d={w.red} fill="#ff5a5a" opacity="0.65" />
          </g>
        ))}
      </g>

      {/* telecom tower */}
      <g stroke="#b9bcd0" strokeWidth="1.6" fill="none" opacity="0.85">
        {legs.map((d, i) => <path key={i} d={d} />)}
        {braces.map((d, i) => <path key={i} d={d} strokeWidth="1" />)}
        <path d={`M${tower.x - 14} ${tower.y + 18}h28M${tower.x - 11} ${tower.y + 40}h22`} />
      </g>
      <g fill="#cfd2e4">
        <rect x={tower.x - 12} y={tower.y + 4} width="5" height="16" rx="1" />
        <rect x={tower.x + 7} y={tower.y + 4} width="5" height="16" rx="1" />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={tower.x} cy={tower.y - 4} r="34" fill="none" stroke="#ff3b3b" strokeWidth="1.6" className="ring" style={{ animationDelay: `${i * 1}s` }} />
      ))}
      <circle cx={tower.x} cy={tower.y - 4} r="4.5" fill="#ff2a2a" />

      <g fill="#070a1b">
        {near.map((b, i) => <path key={i} d={roofPath(b, 805)} />)}
        {nearWin.map((w, i) => (
          <g key={i}>
            <path d={w.warm} fill="#ffe2b8" opacity="0.8" />
            <path d={w.red} fill="#ff4d4d" opacity="0.9" />
          </g>
        ))}
      </g>

      {/* the network: glow underneath, crisp flowing links on top */}
      <g fill="none" strokeLinecap="round">
        <g stroke="#e40000" strokeWidth="6" opacity="0.55" filter="url(#hs-blur)">{arcs.map((d, i) => <path key={i} d={d} />)}</g>
        <g stroke="#ff6b6b" strokeWidth="1.6" opacity="0.5">{arcs.map((d, i) => <path key={i} d={d} />)}</g>
        <g stroke="#fff" strokeWidth="2.2" className="flow">{arcs.map((d, i) => <path key={i} d={d} style={{ animationDelay: `${(i % 4) * -0.5}s` }} />)}</g>
      </g>

      {nodes.map((n, i) => {
        const w = n.label.length * 8 + 30;
        return (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r="14" fill="none" stroke="#ff3b3b" strokeWidth="1.5" className="ring" style={{ animationDelay: `${i * 0.7}s` }} />
            <circle cx={n.x} cy={n.y} r="6.5" fill="#e40000" stroke="#fff" strokeWidth="2.5" />
            <g transform={`translate(${n.x - w / 2} ${n.y - 52})`}>
              <rect width={w} height="28" rx="14" fill="#070a1b" fillOpacity="0.82" stroke="#e40000" strokeWidth="1.5" />
              <circle cx="15" cy="14" r="4" fill="#e40000" />
              <text x={w / 2 + 6} y="19" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="inherit">{n.label}</text>
            </g>
          </g>
        );
      })}

      {/* road */}
      <rect y="805" width="1600" height="95" fill="url(#hs-road)" />
      {[
        [0.0, 828, "#ff3b3b"], [0.35, 846, "#ffffff"], [0.6, 862, "#ff3b3b"], [0.15, 874, "#ffffff"], [0.78, 836, "#ffb3b3"],
      ].map(([x, y, c], i) => (
        <rect key={i} x={(x as number) * 1600} y={y as number} width={260 + i * 40} height="2.4" rx="1.2" fill={c as string} opacity="0.55" />
      ))}
    </svg>
  );
}

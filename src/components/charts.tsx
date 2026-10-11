"use client";
import { useId } from "react";

type Pt = { x: number; y: number };

/** Smooth line through points (monotone-ish cubic). */
function smooth(p: { x: number; y: number }[]) {
  if (p.length < 2) return "";
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], cx = (a.x + b.x) / 2;
    d += ` C${cx},${a.y} ${cx},${b.y} ${b.x},${b.y}`;
  }
  return d;
}

export function LineChart({ points, height = 110, color = "#d6f85a", label, unit, min: fixedMin, max: fixedMax }: { points: Pt[]; height?: number; color?: string; label: string; unit?: string; min?: number; max?: number }) {
  const W = 300, pad = 8;
  if (points.length === 0) return <div className="flex items-center justify-center text-sm opacity-70" style={{ height }}>No data yet</div>;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = fixedMin ?? Math.min(...ys), y1 = fixedMax ?? Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const sx = (x: number) => (x1 === x0 ? W / 2 : pad + ((x - x0) / (x1 - x0)) * (W - pad * 2));
  const sy = (y: number) => height - pad - ((y - y0) / (y1 - y0)) * (height - pad * 2);
  const pts = points.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const last = pts[pts.length - 1];
  const first = points[0], end = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`${label}: from ${first.y}${unit ?? ""} to ${end.y}${unit ?? ""}`} className="block overflow-visible">
      {pts.length > 1 ? <path d={smooth(pts)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
      <circle cx={last.x} cy={last.y} r={6} fill={color} />
    </svg>
  );
}

export function BarChart({ data, height = 120, goal, color = "#14213d", label }: { data: { label: string; value: number; highlight?: boolean }[]; height?: number; goal?: number; color?: string; label: string }) {
  const id = useId();
  const W = 300, gap = 4;
  const max = Math.max(1, ...data.map((d) => d.value), goal ?? 0);
  const bw = (W - gap * (data.length - 1)) / Math.max(1, data.length);
  const sy = (v: number) => (v / max) * (height - 18);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label} className="block">
      {goal ? <line x1="0" x2={W} y1={height - 18 - sy(goal)} y2={height - 18 - sy(goal)} stroke="currentColor" strokeOpacity=".35" strokeDasharray="4 4" /> : null}
      {data.map((d, i) => (
        <g key={`${id}-${i}`}>
          <rect x={i * (bw + gap)} y={height - 18 - sy(d.value)} width={bw} height={Math.max(2, sy(d.value))} rx={3} fill={d.highlight ? "#d6f85a" : color} className={d.highlight ? "" : "dark:fill-[#a3afc6]"} />
          {data.length <= 14 || i % Math.ceil(data.length / 8) === 0 ? <text x={i * (bw + gap) + bw / 2} y={height - 3} textAnchor="middle" fontSize="10" fill="currentColor" opacity=".6">{d.label}</text> : null}
        </g>
      ))}
    </svg>
  );
}

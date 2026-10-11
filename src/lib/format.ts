import { kgToLb, lbToKg, miToKm, kmToMi } from "./domain/units";
import type { Settings } from "./types";

const nf0 = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
export const n0 = (v: number) => nf0.format(v);
export const n1 = (v: number) => nf1.format(v);

export function weightIn(kg: number, unit: Settings["weightUnit"]) {
  return unit === "kg" ? kg : kgToLb(kg);
}
export function weightOut(value: number, unit: Settings["weightUnit"]) {
  return unit === "kg" ? value : lbToKg(value);
}
/** "82.5" in the user's unit, trimmed to 1 decimal. */
export const fmtWeight = (kg: number, unit: Settings["weightUnit"]) => n1(Math.round(weightIn(kg, unit) * 10) / 10);
export const fmtVolume = (kg: number, unit: Settings["weightUnit"]) => {
  const v = weightIn(kg, unit);
  return v >= 10000 ? `${n1(v / 1000)}k` : n0(v);
};
export const distanceIn = (m: number, unit: Settings["distanceUnit"]) => (unit === "km" ? m / 1000 : kmToMi(m / 1000));
export const distanceOut = (v: number, unit: Settings["distanceUnit"]) => (unit === "km" ? v * 1000 : miToKm(v) * 1000);

export function timeAgo(iso: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}
export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** Compact duration for cards: "58m", "1h 6m". */
export function shortDuration(totalSeconds: number) {
  const m = Math.round(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

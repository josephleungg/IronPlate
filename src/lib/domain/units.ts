export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kmToMi = (km: number) => km / KM_PER_MI;
export const miToKm = (mi: number) => mi * KM_PER_MI;

export type WeightUnit = "kg" | "lb";

/** Convert a stored-kg value for display, rounded to something a human would enter. */
export function displayWeight(kg: number, unit: WeightUnit): number {
  const v = unit === "kg" ? kg : kgToLb(kg);
  return Math.round(v * 10) / 10;
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : lbToKg(value);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

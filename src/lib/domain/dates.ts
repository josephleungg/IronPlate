const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** The calendar date (YYYY-MM-DD) it currently is in `timeZone`. */
export function localDate(timeZone: string, at: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ageFromBirthDate(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Monday-based (or Sunday-based) start of the week containing `date`. */
export function startOfWeek(date: string, weekStart: 0 | 1 = 1): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  const diff = (dow - weekStart + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** [start, end) of a local calendar day in `timeZone`, as UTC epoch ms. Handles DST days. */
export function dayRangeUtc(date: string, timeZone: string): [number, number] {
  const edge = (d: string) => {
    const base = Date.parse(`${d}T00:00:00Z`);
    let t = base - tzOffsetMs(timeZone, new Date(base));
    t = base - tzOffsetMs(timeZone, new Date(t)); // second pass settles DST transitions
    return t;
  };
  try {
    return [edge(date), edge(addDays(date, 1))];
  } catch {
    const b = Date.parse(`${date}T00:00:00Z`);
    return [b, b + 86_400_000];
  }
}

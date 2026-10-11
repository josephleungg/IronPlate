"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useState } from "react";
import { BarChart, LineChart } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/providers";
import { Button, Card, Empty, ErrorNote, IconButton, Input, Pill, Segmented, Skeleton, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays } from "@/lib/domain/dates";
import { fmtVolume, n0, n1 } from "@/lib/format";
import { useToday, useUnits } from "@/lib/hooks";
import type { Exercise, Measurement } from "@/lib/types";
import { ExercisePicker } from "../train/exercise-picker";

type Tab = "weight" | "lifts" | "food";

export function ProgressView() {
  const [tab, setTab] = useState<Tab>("weight");
  return (
    <>
      <PageHeader title="Progress" subtitle="Small steps add up." />
      <div className="space-y-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "weight", label: "Weight" }, { value: "lifts", label: "Lifts" }, { value: "food", label: "Food" }]} />
        {tab === "weight" ? <WeightTab /> : tab === "lifts" ? <LiftsTab /> : <FoodTab />}
      </div>
    </>
  );
}

function WeightTab() {
  const u = useUnits();
  const today = useToday();
  const qc = useQueryClient();
  const toast = useToast();
  const [days, setDays] = useState("90");
  const [val, setVal] = useState("");
  const from = addDays(today, -Number(days));
  const m = useQuery({ queryKey: ["measurements", "weight", days, today], queryFn: () => api<{ data: Measurement[] }>(`/measurements?type=weight&from=${from}`) });
  const goal = useQuery({ queryKey: ["weight-goal"], queryFn: () => api<{ targetWeightKg: number } | null>("/goals/weight") });
  const log = useMutation({
    mutationFn: () => api("/measurements", { method: "POST", body: { type: "weight", value: Number(val), unit: u.w } }),
    onSuccess: () => { setVal(""); toast("Weight logged"); qc.invalidateQueries({ queryKey: ["measurements"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/measurements/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }) });

  const rows = m.data?.data ?? [];
  const pts = rows.map((r) => ({ x: new Date(r.measuredAt).getTime(), y: Math.round(u.show(r.value) * 10) / 10 }));
  const latest = rows[rows.length - 1], first = rows[0];
  const change = latest && first && rows.length > 1 ? u.show(latest.value) - u.show(first.value) : 0;

  return (
    <div className="space-y-3">
      <Card tone="hero" className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm text-hero-muted">Current weight</div>
            <div className="display text-5xl leading-none">{latest ? n1(u.show(latest.value)) : "–"}<span className="ml-1 text-lg font-medium text-hero-muted">{u.w}</span></div>
          </div>
          {rows.length > 1 ? <Pill tone="lime">{change <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}{n1(Math.abs(change))} {u.w}</Pill> : null}
        </div>
        {m.isLoading ? <Skeleton className="h-28 bg-white/10" /> : <LineChart points={pts} label="Weight" unit={u.w} />}
        <div className="flex justify-between text-sm text-hero-muted"><span>Last {days} days</span>{goal.data ? <span>Goal {n1(u.show(goal.data.targetWeightKg))} {u.w}</span> : null}</div>
      </Card>
      <Segmented value={days} onChange={setDays} options={[{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "1 year" }]} />
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); if (Number(val) > 0) log.mutate(); }} className="flex gap-2">
          <Input aria-label={`Weight in ${u.w}`} inputMode="decimal" placeholder={`Today's weight (${u.w})`} value={val} onChange={(e) => setVal(e.target.value.replace(",", "."))} />
          <Button type="submit" loading={log.isPending} disabled={!(Number(val) > 0)}>Log</Button>
        </form>
        <ErrorNote error={log.error ?? del.error} />
      </Card>
      {rows.length ? (
        <Card>
          <h2 className="mb-1 text-xl">History</h2>
          <ul className="divide-y divide-border">{[...rows].reverse().slice(0, 12).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-1">
              <span className="text-muted">{new Date(r.measuredAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
              <span className="flex items-center"><span className="display text-lg">{n1(u.show(r.value))} {u.w}</span><IconButton label="Delete this entry" className="size-9" onClick={() => del.mutate(r.id)}><Trash2 size={16} className="text-muted" /></IconButton></span>
            </li>
          ))}</ul>
        </Card>
      ) : !m.isLoading ? <Empty title="No weigh-ins yet" body="Log your weight above to start a trend line. Weekly is plenty." /> : null}
    </div>
  );
}

type Report = { totals: { workouts: number; volumeKg: number; durationS: number; sets: number; prs: number }; weeks: { week: string; workouts: number; volumeKg: number }[]; muscles: { slug: string; name: string; sets: number }[] };
type Stats = { exercise: Exercise; series: { workoutId: string; date: string; est1rm: number | null; maxWeight: number | null; volume: number }[]; records: Record<string, number> };

function LiftsTab() {
  const u = useUnits();
  const today = useToday();
  const [days, setDays] = useState("30");
  const [picker, setPicker] = useState(false);
  const [ex, setEx] = useState<Exercise | null>(null);
  const report = useQuery({ queryKey: ["report", "training", days, today], queryFn: () => api<Report>(`/reports/training?from=${addDays(today, -Number(days))}&to=${today}`) });
  const stats = useQuery({ queryKey: ["ex-stats", ex?.id], queryFn: () => api<Stats>(`/exercises/${ex!.id}/stats`), enabled: Boolean(ex) });
  const r = report.data;
  const maxSets = Math.max(1, ...(r?.muscles.map((m) => m.sets) ?? [1]));
  const series = (stats.data?.series ?? []).filter((s) => s.est1rm != null).map((s) => ({ x: new Date(s.date).getTime(), y: Math.round(u.liftShow(s.est1rm!) * 10) / 10 }));
  const best = stats.data?.records.est_1rm;

  return (
    <div className="space-y-3">
      <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
      {report.isLoading ? <Skeleton className="h-32" /> : r ? (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Workouts" value={r.totals.workouts} />
            <Stat label="Volume" value={fmtVolume(r.totals.volumeKg, u.lift)} unit={u.lift} />
            <Stat label="PRs" value={r.totals.prs} tone="lime" />
          </div>
          {r.weeks.length ? (
            <Card><h2 className="mb-2 text-xl">Weekly volume</h2><BarChart label="Volume per week" data={r.weeks.map((w, i) => ({ label: new Date(`${w.week}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" }), value: Math.round(u.liftShow(w.volumeKg)), highlight: i === r.weeks.length - 1 }))} /></Card>
          ) : <Empty title="No training in this period" body="Log a workout and your volume shows up here." />}
          {r.muscles.length ? (
            <Card>
              <h2 className="mb-3 text-xl">Sets per muscle</h2>
              <ul className="space-y-2.5">{r.muscles.slice(0, 8).map((m) => (
                <li key={m.slug}><div className="mb-1 flex justify-between text-sm"><span>{m.name}</span><span className="display text-muted">{m.sets}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full rounded-full bg-[#14213d] dark:bg-lime" style={{ width: `${(m.sets / maxSets) * 100}%` }} /></div></li>
              ))}</ul>
            </Card>
          ) : null}
        </>
      ) : null}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-xl">Lift progress</h2><Button size="sm" variant="secondary" onClick={() => setPicker(true)}>{ex ? "Change" : "Pick a lift"}</Button></div>
        {!ex ? <p className="text-sm text-muted">Choose an exercise to see your estimated one-rep max over time.</p> : stats.isLoading ? <Skeleton className="h-32" /> : (
          <>
            <div className="flex items-end justify-between"><div><div className="text-sm text-muted">{ex.name}</div><div className="display text-4xl leading-tight">{best ? n1(u.liftShow(best)) : "–"}<span className="ml-1 text-sm font-medium text-muted">{u.lift} est. 1RM</span></div></div>{best ? <Trophy className="text-muted" /> : null}</div>
            {series.length ? <div className="text-[#14213d] dark:text-lime"><LineChart points={series} color="currentColor" label={`${ex.name} estimated one rep max`} unit={u.lift} /></div> : <p className="text-sm text-muted">Not enough weighted sets yet. Estimates need 12 reps or fewer.</p>}
          </>
        )}
      </Card>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={setEx} />
    </div>
  );
}

function FoodTab() {
  const today = useToday();
  const [days, setDays] = useState("14");
  const from = addDays(today, -(Number(days) - 1));
  const q = useQuery({ queryKey: ["range", from, today], queryFn: () => api<{ data: { date: string; kcal: number; proteinG: number; carbsG: number; fatG: number }[] }>(`/diary?from=${from}&to=${today}`) });
  const goal = useQuery({ queryKey: ["goal-now", today], queryFn: () => api<{ calories: number; proteinG: number } | null>("/goals/nutrition") });
  const byDate = new Map((q.data?.data ?? []).map((d) => [d.date, d]));
  const all = Array.from({ length: Number(days) }, (_, i) => addDays(from, i));
  const logged = all.map((d) => byDate.get(d)).filter(Boolean) as NonNullable<ReturnType<typeof byDate.get>>[];
  const avg = (k: "kcal" | "proteinG") => (logged.length ? logged.reduce((a, d) => a + d[k], 0) / logged.length : 0);
  return (
    <div className="space-y-3">
      <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }]} />
      {q.isLoading ? <Skeleton className="h-48" /> : logged.length ? (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Avg calories" value={n0(avg("kcal"))} />
            <Stat label="Avg protein" value={n0(avg("proteinG"))} unit="g" />
            <Stat label="Days logged" value={`${logged.length}/${days}`} tone="lime" />
          </div>
          <Card>
            <h2 className="mb-2 text-xl">Calories per day</h2>
            <BarChart label="Calories per day" goal={goal.data?.calories} data={all.map((d, i) => ({ label: new Date(`${d}T12:00:00`).toLocaleDateString("en", { day: "numeric" }), value: byDate.get(d)?.kcal ?? 0, highlight: i === all.length - 1 }))} />
            {goal.data ? <p className="mt-1 text-xs text-muted">Dashed line is your {n0(goal.data.calories)} kcal goal.</p> : null}
          </Card>
        </>
      ) : <Empty title="No food logged in this period" body="Log meals in your diary and your averages show up here." />}
    </div>
  );
}

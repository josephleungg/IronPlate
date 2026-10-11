"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Droplets, Plus, Undo2, Copy } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/providers";
import { Button, Card, Empty, ErrorNote, IconButton, Ring, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays } from "@/lib/domain/dates";
import { n0 } from "@/lib/format";
import { useMe, useToday } from "@/lib/hooks";
import type { DayData, Entry } from "@/lib/types";
import { AddFoodSheet } from "./add-food-sheet";
import { EditEntrySheet } from "./edit-entry-sheet";

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  if (date === addDays(today, 1)) return "Tomorrow";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "long" });
}

function MacroTile({ label, value, goal, color }: { label: string; value: number; goal?: number; color: string }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <Card className="px-3 py-3.5">
      <div className="text-sm text-muted">{label}</div>
      <div className="display mt-0.5 text-[26px] leading-tight">{n0(value)}<span className="text-sm font-medium opacity-70">g</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track" role="img" aria-label={goal ? `${n0(value)} of ${n0(goal)} grams` : `${n0(value)} grams`}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      {goal ? <div className="mt-1 text-xs text-muted">of {n0(goal)}g</div> : null}
    </Card>
  );
}

export function DiaryView() {
  const me = useMe();
  const today = useToday();
  const toast = useToast();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const [addTo, setAddTo] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  const day = useQuery({ queryKey: ["day", date], queryFn: () => api<DayData>(`/diary/${date}`), enabled: Boolean(me.data) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["day", date] });

  const water = useMutation({
    mutationFn: (ml: number) => api(`/diary/${date}/water`, { method: "POST", body: { amountMl: ml } }),
    onSuccess: refresh,
  });
  const undoWater = useMutation({
    mutationFn: (id: string) => api(`/diary/water/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const copyYesterday = useMutation({
    mutationFn: () => api<{ copied: number }>(`/diary/${date}/copy`, { method: "POST", body: { fromDate: addDays(date, -1) } }),
    onSuccess: (r) => { toast(r.copied ? `Copied ${r.copied} items` : "Nothing logged yesterday"); refresh(); },
  });

  const d = day.data;
  const goal = d?.goal;
  const eaten = d?.totals.kcal ?? 0;
  const left = goal ? goal.calories - eaten : null;
  const hasEntries = (d?.totals.kcal ?? 0) > 0 || d?.meals.some((m) => m.entries.length);

  return (
    <>
      <PageHeader title={dayLabel(date, today)} subtitle={new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })} />

      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Previous day" onClick={() => setPicked(addDays(date, -1))}><ChevronLeft /></IconButton>
        {date !== today ? <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Back to today</Button> : <span />}
        <IconButton label="Next day" onClick={() => setPicked(addDays(date, 1))}><ChevronRight /></IconButton>
      </div>

      {day.isLoading || !d ? (
        <div className="space-y-3"><Skeleton className="h-36" /><div className="grid grid-cols-3 gap-2.5"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-40" /></div>
      ) : (
        <div className="space-y-3">
          <ErrorNote error={day.error} />
          <Card tone="hero" className="flex items-center gap-4">
            <Ring value={goal ? eaten / goal.calories : 0} size={104}>
              <span className="display text-xl">{goal ? `${Math.min(999, Math.round((eaten / goal.calories) * 100))}%` : ""}</span>
            </Ring>
            <div className="min-w-0">
              <div className="display text-[44px] leading-none">{left === null ? n0(eaten) : n0(Math.abs(left))}</div>
              <div className="mt-1 text-sm text-hero-muted">{left === null ? "kcal eaten" : left >= 0 ? "kcal left today" : "kcal over goal"}</div>
              <div className="mt-2 text-[13px] text-hero-muted">{n0(eaten)} eaten{goal ? ` · ${n0(goal.calories)} goal` : ""}</div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2.5">
            <MacroTile label="Protein" value={d.totals.proteinG} goal={goal?.proteinG} color="#14213d" />
            <MacroTile label="Carbs" value={d.totals.carbsG} goal={goal?.carbsG} color="#d6f85a" />
            <MacroTile label="Fat" value={d.totals.fatG} goal={goal?.fatG} color="#526079" />
          </div>
          {d.exerciseKcal > 0 ? <p className="px-1 text-sm text-muted">Training today: about {n0(d.exerciseKcal)} kcal burned (estimate, not added to your goal).</p> : null}

          {!hasEntries ? (
            <Empty title="Nothing logged yet" body="Add your first food, or copy what you ate yesterday." action={<Button variant="secondary" size="sm" loading={copyYesterday.isPending} onClick={() => copyYesterday.mutate()}><Copy size={16} />Copy yesterday</Button>} />
          ) : null}

          {d.meals.map((m) => (
            <Card key={m.slot.id}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[22px]">{m.slot.name}</h2>
                <span className="display text-base font-medium text-muted">{n0(m.totals.kcal)} kcal</span>
              </div>
              <ul>
                {m.entries.map((e) => (
                  <li key={e.id} className="mt-2.5 border-t border-border pt-2.5">
                    <button onClick={() => setEditing(e)} className="flex w-full items-start justify-between gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-foreground">
                      <span className="min-w-0">
                        <span className="block truncate">{e.name}</span>
                        <span className="block text-sm text-muted">{e.source === "quick_add" ? "Quick add" : `${n0(e.servings * 100) === "100" ? "1" : Math.round(e.servings * 100) / 100} serving${e.servings === 1 ? "" : "s"}${e.brand ? ` · ${e.brand}` : ""}`}</span>
                      </span>
                      <span className="display text-base">{n0(e.kcal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setAddTo({ id: m.slot.id, name: m.slot.name })} className="mt-3 flex min-h-11 w-full items-center gap-2 border-t border-border pt-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foreground">
                <span className="flex size-6 items-center justify-center rounded-md bg-lime text-[#14213d]"><Plus size={16} strokeWidth={2.5} /></span>Add food
              </button>
            </Card>
          ))}

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Droplets size={20} className="text-muted" /><h2 className="text-[22px]">Water</h2></div>
              <span className="display text-base font-medium text-muted">{n0(d.water.totalMl)} / {n0(d.water.goalMl)} ml</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full rounded-full bg-[#14213d] transition-[width] duration-500 dark:bg-lime" style={{ width: `${Math.min(100, (d.water.totalMl / d.water.goalMl) * 100)}%` }} /></div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => water.mutate(250)} disabled={water.isPending}>+250 ml</Button>
              <Button variant="secondary" size="sm" onClick={() => water.mutate(500)} disabled={water.isPending}>+500 ml</Button>
              {d.water.logs.length ? <Button variant="ghost" size="sm" onClick={() => undoWater.mutate(d.water.logs[d.water.logs.length - 1].id)} disabled={undoWater.isPending}><Undo2 size={16} />Undo</Button> : null}
            </div>
          </Card>
        </div>
      )}

      <AddFoodSheet open={Boolean(addTo)} slot={addTo} date={date} onClose={() => setAddTo(null)} onAdded={() => { refresh(); qc.invalidateQueries({ queryKey: ["foods", "recent"] }); }} />
      <EditEntrySheet entry={editing} onClose={() => setEditing(null)} onChanged={refresh} />
    </>
  );
}

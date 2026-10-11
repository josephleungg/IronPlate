"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, ErrorNote, Field, IconButton, Input, Select, Sheet, Stat, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { EXERCISE_FIELDS, workoutTotals, type ExerciseType } from "@/lib/domain/training";
import { clock, fmtVolume, n0 } from "@/lib/format";
import { useMe, useUnits } from "@/lib/hooks";
import type { Exercise, SetType, WorkoutDetail, WorkoutSet } from "@/lib/types";
import { clearDraft, nav, newExercise, newSet, updateDraft, useDraft, type Draft, type DraftExercise, type DraftSet } from "@/lib/workout-store";
import { ExercisePicker } from "../exercise-picker";

const DEFAULT_REST = 90;
const TYPE_CYCLE: SetType[] = ["normal", "warmup", "failure", "drop"];
const TYPE_LABEL: Record<SetType, string> = { normal: "", warmup: "W", failure: "F", drop: "D" };

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function Logger() {
  const router = useRouter();
  const draft = useDraft();
  // false during SSR and hydration, true afterwards: the draft only exists in the browser.
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  useEffect(() => { if (ready && !draft && !nav.to) router.replace("/train"); }, [ready, draft, router]);
  if (!draft) return null;
  return <LoggerBody draft={draft} />;
}

function LoggerBody({ draft }: { draft: Draft }) {
  const u = useUnits();
  const now = useNow(true);
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [menu, setMenu] = useState(false);

  const ids = draft.exercises.map((e) => e.exerciseId).join(",");
  const prev = useQuery({ queryKey: ["previous", ids], queryFn: () => api<{ data: Record<string, WorkoutSet[]> }>(`/exercises/previous?ids=${ids}`), enabled: ids.length > 0 });

  // Rest timer: clears itself when it finishes.
  const restLeft = draft.restEndsAt ? Math.max(0, Math.ceil((draft.restEndsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (draft.restEndsAt && now >= draft.restEndsAt) {
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
      updateDraft((d) => ({ ...d, restEndsAt: null }));
    }
  }, [now, draft.restEndsAt]);

  const toKgSets = (e: DraftExercise) => e.sets.filter((s) => s.done).map((s) => ({ setType: s.setType, weightKg: s.weight ? u.toKg(Number(s.weight)) : 0, reps: s.reps ? Number(s.reps) : 0 }));
  const totals = workoutTotals(draft.exercises.map((e) => ({ type: e.type as ExerciseType, sets: toKgSets(e) })));
  const setsDone = totals.totalSets;

  const patchExercise = (key: string, fn: (e: DraftExercise) => DraftExercise) =>
    updateDraft((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)) }));
  const patchSet = (key: string, id: string, fn: (s: DraftSet) => DraftSet) =>
    patchExercise(key, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === id ? fn(s) : s)) }));

  const startRest = (secs: number) => updateDraft((d) => ({ ...d, restEndsAt: Date.now() + secs * 1000, restTotal: secs }));

  function toggleDone(e: DraftExercise, s: DraftSet, idx: number) {
    const p = prev.data?.data[e.exerciseId]?.[idx];
    if (!s.done) {
      // Blank fields take last time's numbers, so a repeat set is a single tap.
      const fill = (cur: string, v: number | null | undefined, conv: (n: number) => number = (n) => n) => (cur !== "" || v == null ? cur : String(Math.round(conv(v) * 10) / 10));
      patchSet(e.key, s.id, (x) => ({ ...x, done: true, weight: fill(x.weight, p?.weightKg, u.show), reps: fill(x.reps, p?.reps), duration: fill(x.duration, p?.durationS, (n) => n / 60), distance: fill(x.distance, p?.distanceM, u.distShow) }));
      startRest(e.restSeconds ?? DEFAULT_REST);
    } else patchSet(e.key, s.id, (x) => ({ ...x, done: false }));
  }

  const addExercise = (ex: Exercise) =>
    updateDraft((d) => ({ ...d, exercises: [...d.exercises, newExercise({ id: ex.id, name: ex.name, type: ex.exerciseType })] }));

  return (
    <div className="pb-40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input aria-label="Workout name" value={draft.title} onChange={(e) => updateDraft((d) => ({ ...d, title: e.target.value }))} maxLength={80}
            className="w-full rounded-lg bg-transparent font-display text-[32px] font-bold leading-tight tracking-tight focus-visible:outline-2 focus-visible:outline-foreground" />
          <div className="display mt-1 text-4xl leading-none" aria-label="Elapsed time">{clock((now - draft.startedAt) / 1000)}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={() => setFinishing(true)} disabled={setsDone === 0 && !draft.exercises.some((e) => e.sets.some((s) => s.done))}>Finish</Button>
          <button onClick={() => setMenu(true)} className="min-h-9 px-2 text-sm text-muted underline underline-offset-4">Discard</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Sets" value={setsDone} />
        <Stat label="Volume" value={fmtVolume(totals.totalVolumeKg, u.w)} unit={u.w} />
        <Stat label="Exercises" value={draft.exercises.length} tone="lime" />
      </div>

      <div className="mt-3 space-y-3">
        {draft.exercises.map((e) => (
          <ExerciseCard key={e.key} e={e} prev={prev.data?.data[e.exerciseId]} unitW={u.w} unitD={u.d}
            onSet={(id, fn) => patchSet(e.key, id, fn)} onToggle={(s, i) => toggleDone(e, s, i)}
            onAddSet={() => patchExercise(e.key, (x) => { const last = x.sets[x.sets.length - 1]; return { ...x, sets: [...x.sets, newSet(last ? { weight: last.weight, reps: last.reps, duration: last.duration, distance: last.distance } : {})] }; })}
            onRemoveSet={(id) => patchExercise(e.key, (x) => ({ ...x, sets: x.sets.filter((s) => s.id !== id) }))}
            onRemove={() => updateDraft((d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== e.key) }))} />
        ))}
        <Button variant="secondary" className="w-full" onClick={() => setPicker(true)}><Plus size={18} />Add exercise</Button>
      </div>

      {restLeft > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg p-3">
          <Card tone="lavender" className="flex items-center justify-between gap-2 shadow-lg" role="timer" aria-label="Rest timer">
            <div><div className="text-sm opacity-80">Rest</div><div className="display text-4xl leading-none">{clock(restLeft)}</div></div>
            <div className="flex items-center gap-1.5">
              <IconButton label="Take off 15 seconds" onClick={() => updateDraft((d) => ({ ...d, restEndsAt: (d.restEndsAt ?? Date.now()) - 15_000 }))}><Minus size={18} /></IconButton>
              <IconButton label="Add 15 seconds" onClick={() => updateDraft((d) => ({ ...d, restEndsAt: (d.restEndsAt ?? Date.now()) + 15_000 }))}><Plus size={18} /></IconButton>
              <Button size="sm" onClick={() => updateDraft((d) => ({ ...d, restEndsAt: null }))}>Skip</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />
      <FinishSheet open={finishing} onClose={() => setFinishing(false)} draft={draft} />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Discard this workout?">
        <div className="space-y-3"><p className="text-muted">Everything you&apos;ve logged in this session will be deleted.</p>
          <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setMenu(false)}>Keep going</Button><DiscardButton /></div></div>
      </Sheet>
    </div>
  );
}

function DiscardButton() {
  const router = useRouter();
  return <Button variant="danger" className="flex-1" onClick={() => { clearDraft(); router.replace("/train"); }}><Trash2 size={18} />Discard</Button>;
}

function prevText(type: ExerciseType, p: WorkoutSet | undefined, u: { w: "kg" | "lb"; d: "km" | "mi" }, show: (kg: number) => number, distShow: (m: number) => number) {
  if (!p) return "–";
  const f = EXERCISE_FIELDS[type];
  const parts: string[] = [];
  if (f.weight && p.weightKg != null) parts.push(`${Math.round(show(p.weightKg) * 10) / 10}`);
  if (f.reps && p.reps != null) parts.push(`${p.reps}`);
  if (f.duration && p.durationS != null) parts.push(`${Math.round((p.durationS / 60) * 10) / 10}m`);
  if (f.distance && p.distanceM != null) parts.push(`${Math.round(distShow(p.distanceM) * 100) / 100}${u.d}`);
  return parts.join(" × ") || "–";
}

function ExerciseCard({ e, prev, unitW, unitD, onSet, onToggle, onAddSet, onRemoveSet, onRemove }: {
  e: DraftExercise; prev?: WorkoutSet[]; unitW: "kg" | "lb"; unitD: "km" | "mi";
  onSet: (id: string, fn: (s: DraftSet) => DraftSet) => void; onToggle: (s: DraftSet, i: number) => void; onAddSet: () => void; onRemoveSet: (id: string) => void; onRemove: () => void;
}) {
  const u = useUnits();
  const f = EXERCISE_FIELDS[e.type as ExerciseType];
  const cols = ["28px", "minmax(0,1fr)", ...(f.weight ? ["60px"] : []), ...(f.reps ? ["56px"] : []), ...(f.duration ? ["60px"] : []), ...(f.distance ? ["60px"] : []), "36px"].join(" ");
  const num = (field: "weight" | "reps" | "duration" | "distance", s: DraftSet, ph: string, label: string) => (
    <input aria-label={`${label}, set`} inputMode="decimal" value={s[field]} placeholder={ph}
      onChange={(ev) => onSet(s.id, (x) => ({ ...x, [field]: ev.target.value.replace(",", ".") }))}
      className={cx("display h-10 min-w-0 rounded-lg border border-border bg-background text-center text-lg placeholder:text-muted/50 focus-visible:outline-2 focus-visible:outline-foreground", s.done && "border-transparent bg-track")} />
  );
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-xl">{e.name}</h2>
        <IconButton label={`Remove ${e.name}`} className="-mr-2 size-9" onClick={() => { if (!e.sets.some((s) => s.done) || confirm(`Remove ${e.name} and its sets?`)) onRemove(); }}><X size={18} className="text-muted" /></IconButton>
      </div>
      <div className="grid items-center gap-x-1.5 pb-1 text-xs text-muted" style={{ gridTemplateColumns: cols }}>
        <span>Set</span><span>Previous</span>
        {f.weight ? <span className="text-center">{f.weightLabel ?? unitW}</span> : null}
        {f.reps ? <span className="text-center">Reps</span> : null}
        {f.duration ? <span className="text-center">Min</span> : null}
        {f.distance ? <span className="text-center">{unitD}</span> : null}
        <span />
      </div>
      <div className="space-y-1.5">
        {e.sets.map((s, i) => {
          const p = prev?.[i];
          const working = e.sets.slice(0, i).filter((x) => x.setType !== "warmup").length + 1;
          return (
            <div key={s.id} className="grid items-center gap-x-1.5" style={{ gridTemplateColumns: cols }}>
              <button onClick={() => onSet(s.id, (x) => ({ ...x, setType: TYPE_CYCLE[(TYPE_CYCLE.indexOf(x.setType) + 1) % TYPE_CYCLE.length] }))}
                aria-label={`Set ${i + 1}, ${s.setType} set. Tap to change type.`} className={cx("display flex h-10 items-center justify-center rounded-lg text-base", s.setType !== "normal" && "bg-lavender text-lavender-fg")}>
                {TYPE_LABEL[s.setType] || working}
              </button>
              <span className="display truncate text-sm text-muted">{prevText(e.type as ExerciseType, p, { w: unitW, d: unitD }, u.show, u.distShow)}</span>
              {f.weight ? num("weight", s, p?.weightKg != null ? String(Math.round(u.show(p.weightKg) * 10) / 10) : "", f.weightLabel ?? "Weight") : null}
              {f.reps ? num("reps", s, p?.reps != null ? String(p.reps) : "", "Reps") : null}
              {f.duration ? num("duration", s, p?.durationS != null ? String(Math.round(p.durationS / 6) / 10) : "", "Minutes") : null}
              {f.distance ? num("distance", s, p?.distanceM != null ? String(Math.round(u.distShow(p.distanceM) * 100) / 100) : "", "Distance") : null}
              <button onClick={() => onToggle(s, i)} aria-pressed={s.done} aria-label={`Mark set ${i + 1} ${s.done ? "not done" : "done"}`}
                className={cx("flex size-9 items-center justify-center rounded-lg border-2 transition-colors", s.done ? "border-lime bg-lime text-[#14213d]" : "border-border text-transparent")}>
                <Check size={18} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <button onClick={onAddSet} className="flex min-h-9 items-center gap-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-foreground"><span className="flex size-6 items-center justify-center rounded-md bg-lime text-[#14213d]"><Plus size={16} strokeWidth={2.5} /></span>Add set</button>
        {e.sets.length > 1 ? <button onClick={() => onRemoveSet(e.sets[e.sets.length - 1].id)} className="min-h-9 text-sm text-muted">Remove last set</button> : null}
      </div>
    </Card>
  );
}

function FinishSheet({ open, onClose, draft }: { open: boolean; onClose: () => void; draft: Draft }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const u = useUnits();
  const me = useMe();
  const [title, setTitle] = useState(draft.title);
  const [visibility, setVisibility] = useState<string>("");
  const [share, setShare] = useState(true);
  const [caption, setCaption] = useState("");
  const vis = visibility || me.data?.settings.defaultWorkoutVisibility || "followers";

  const save = useMutation({
    mutationFn: () => {
      const exercises = draft.exercises
        .map((e) => ({
          exerciseId: e.exerciseId, restSeconds: e.restSeconds ?? undefined,
          sets: e.sets.filter((s) => s.done).map((s) => ({
            setType: s.setType,
            weightKg: s.weight !== "" ? Math.round(u.toKg(Number(s.weight)) * 100) / 100 : undefined,
            reps: s.reps !== "" ? Math.round(Number(s.reps)) : undefined,
            durationS: s.duration !== "" ? Math.round(Number(s.duration) * 60) : undefined,
            distanceM: s.distance !== "" ? Math.round(u.distToM(Number(s.distance))) : undefined,
          })),
        }))
        .filter((e) => e.sets.length);
      if (!exercises.length) throw new Error("Mark at least one set as done before finishing.");
      return api<WorkoutDetail>("/workouts", {
        method: "POST",
        body: { id: draft.id, title: title.trim() || "Workout", startedAt: new Date(draft.startedAt).toISOString(), endedAt: new Date().toISOString(), routineId: draft.routineId ?? undefined, visibility: vis, share: share && vis !== "private", caption: caption.trim() || undefined, exercises },
      });
    },
    onSuccess: (w) => {
      nav.to = `/train/w/${w.id}`;
      clearDraft();
      window.setTimeout(() => { nav.to = null; }, 2000);
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["day"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast(w.prCount ? `Workout saved. ${w.prCount} new PR${w.prCount === 1 ? "" : "s"}!` : "Workout saved. Nice work.");
      router.replace(`/train/w/${w.id}`);
    },
  });

  return (
    <Sheet open={open} onClose={onClose} title="Finish workout">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Workout name"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></Field>
        <Field label="Who can see it?">
          <Select value={vis} onChange={(e) => setVisibility(e.target.value)}><option value="private">Only me</option><option value="followers">Followers</option><option value="public">Everyone</option></Select>
        </Field>
        {vis !== "private" ? (
          <>
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-5 accent-[#14213d]" /><span>Share to the feed</span></label>
            {share ? <Field label="Add a note (optional)"><Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder="How did it feel?" /></Field> : null}
          </>
        ) : null}
        <p className="text-sm text-muted">Only sets you&apos;ve ticked are saved. {n0(draft.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0))} set{draft.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0) === 1 ? "" : "s"} across {draft.exercises.filter((e) => e.sets.some((s) => s.done)).length} exercise{draft.exercises.filter((e) => e.sets.some((s) => s.done)).length === 1 ? "" : "s"}.</p>
        <ErrorNote error={save.error} />
        <Button type="submit" className="w-full" loading={save.isPending}>Save workout</Button>
      </form>
    </Sheet>
  );
}

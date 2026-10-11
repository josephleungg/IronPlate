"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";
import { Avatar, Button, Card, Empty, ErrorNote, Pill, Skeleton, Stat } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { EXERCISE_FIELDS, type ExerciseType } from "@/lib/domain/training";
import { clock, fmtVolume, n0 } from "@/lib/format";
import { useMe, useUnits } from "@/lib/hooks";
import type { RoutineDetail, WorkoutDetail, WorkoutSet } from "@/lib/types";
import { newExercise, newSet, startDraft, getDraft, type DraftExercise } from "@/lib/workout-store";

const RECORD_LABEL: Record<string, string> = { max_weight: "Heaviest weight", est_1rm: "Est. 1RM", max_set_volume: "Best set volume", max_reps: "Most reps", max_duration: "Longest time", max_distance: "Longest distance" };

export function WorkoutDetailView({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const u = useUnits();
  const me = useMe();
  const w = useQuery({ queryKey: ["workout", id], queryFn: () => api<WorkoutDetail>(`/workouts/${id}`), retry: false });

  const del = useMutation({
    mutationFn: () => api(`/workouts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workouts"] }); qc.invalidateQueries({ queryKey: ["feed"] }); toast("Workout deleted"); router.replace("/train"); },
  });
  const saveRoutine = useMutation({
    mutationFn: () => api<RoutineDetail>(`/routines/from-workout/${id}`, { method: "POST", body: {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routines"] }); toast("Saved as a routine"); },
  });

  function repeat() {
    if (!w.data) return;
    if (getDraft() && !confirm("You already have a workout in progress. Replace it?")) return;
    const exercises: DraftExercise[] = w.data.exercises.map((e) => ({
      ...newExercise({ id: e.exerciseId, name: e.name, type: e.type }, 0),
      sets: e.sets.map((s) => newSet({ setType: s.setType })),
    }));
    startDraft({ title: w.data.title, exercises });
    router.push("/train/workout");
  }

  if (w.isLoading) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-28" /><Skeleton className="h-48" /></div>;
  if (w.error instanceof ApiError && w.error.status === 404) return <Empty title="Workout not found" body="It may have been deleted, or it isn't shared with you." action={<Link href="/train"><Button variant="secondary">Back to Train</Button></Link>} />;
  if (!w.data) return <ErrorNote error={w.error} />;
  const d = w.data;
  const mine = me.data?.id === d.author.id;

  return (
    <div className="space-y-4">
      <Link href={mine ? "/train" : "/friends"} className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted"><ArrowLeft size={18} />Back</Link>
      <header className="space-y-2">
        <h1 className="text-[32px] leading-tight">{d.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted"><Avatar name={d.author.displayName} size={28} />{mine ? "You" : d.author.displayName} · {new Date(d.startedAt).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}<Pill className="ml-auto capitalize">{d.visibility}</Pill></div>
        {d.description ? <p>{d.description}</p> : null}
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Time" value={clock(d.durationS)} />
        <Stat label="Volume" value={fmtVolume(d.totalVolumeKg, u.lift)} unit={u.lift} />
        <Stat label="Sets" value={d.totalSets} />
        <Stat label="New PRs" value={d.prCount} tone={d.prCount ? "lime" : "default"} />
      </div>

      {d.exercises.map((e) => {
        const f = EXERCISE_FIELDS[e.type as ExerciseType];
        return (
          <Card key={e.id}>
            <h2 className="mb-2 text-xl">{e.name}</h2>
            {e.records.length ? <div className="mb-3 flex flex-wrap gap-2">{e.records.map((r) => <Pill key={r.recordType} tone="lime"><Trophy size={14} />{RECORD_LABEL[r.recordType] ?? r.recordType}: {r.recordType.includes("weight") || r.recordType.includes("1rm") || r.recordType.includes("volume") ? `${n0(u.liftShow(r.value))} ${u.lift}` : n0(r.value)}</Pill>)}</div> : null}
            <ol className="divide-y divide-border">
              {e.sets.map((s: WorkoutSet, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className="display w-8 text-muted">{s.setType === "warmup" ? "W" : s.setType === "failure" ? "F" : s.setType === "drop" ? "D" : e.sets.slice(0, i).filter((x) => x.setType !== "warmup").length + 1}</span>
                  <span className="display text-lg">
                    {[f.weight && s.weightKg != null ? `${Math.round(u.liftShow(s.weightKg) * 10) / 10} ${u.lift}` : null, f.reps && s.reps != null ? `${s.reps} reps` : null, f.duration && s.durationS != null ? clock(s.durationS) : null, f.distance && s.distanceM != null ? `${Math.round(u.distShow(s.distanceM) * 100) / 100} ${u.d}` : null].filter(Boolean).join(" × ")}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        );
      })}

      {mine ? (
        <div className="space-y-2">
          <ErrorNote error={del.error ?? saveRoutine.error} />
          <Button className="w-full" onClick={repeat}><Copy size={18} />Do this workout again</Button>
          <Button variant="secondary" className="w-full" loading={saveRoutine.isPending} onClick={() => saveRoutine.mutate()}>Save as routine</Button>
          <Button variant="danger" className="w-full" loading={del.isPending} onClick={() => { if (confirm("Delete this workout? Your PRs will be recalculated.")) del.mutate(); }}><Trash2 size={18} />Delete workout</Button>
        </div>
      ) : (
        <Button className="w-full" onClick={repeat}><Copy size={18} />Do this workout</Button>
      )}
    </div>
  );
}

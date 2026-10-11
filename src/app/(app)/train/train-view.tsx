"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Play, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/providers";
import { Button, Card, Empty, ErrorNote, IconButton, Pill, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { clock, fmtVolume, timeAgo } from "@/lib/format";
import { useUnits } from "@/lib/hooks";
import type { Page, Routine, RoutineDetail, WorkoutSummary } from "@/lib/types";
import { newExercise, newSet, startDraft, useDraft, type DraftExercise } from "@/lib/workout-store";

/** Turn a saved routine into a draft workout, prefilling targets in the user's units. */
export function routineToExercises(r: RoutineDetail, show: (kg: number) => number): DraftExercise[] {
  return r.exercises.map((e) => ({
    ...newExercise({ id: e.exerciseId, name: e.name, type: e.type }, 0),
    restSeconds: e.restSeconds,
    sets: e.sets.map((s) => newSet({
      setType: s.setType,
      weight: s.targetWeightKg != null ? String(Math.round(show(s.targetWeightKg) * 10) / 10) : "",
      reps: s.targetRepsMin != null ? String(s.targetRepsMin) : "",
      duration: s.targetDurationS != null ? String(Math.round((s.targetDurationS / 60) * 10) / 10) : "",
    })),
  }));
}

export function TrainView() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const u = useUnits();
  const draft = useDraft();

  const routines = useQuery({ queryKey: ["routines"], queryFn: () => api<{ routines: Routine[] }>("/routines") });
  const history = useInfiniteQuery({
    queryKey: ["workouts"],
    queryFn: ({ pageParam }) => api<Page<WorkoutSummary>>(`/workouts?limit=10${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });

  const startRoutine = useMutation({
    mutationFn: (id: string) => api<RoutineDetail>(`/routines/${id}`),
    onSuccess: (r) => { startDraft({ title: r.name, routineId: r.id, exercises: routineToExercises(r, u.show) }); router.push("/train/workout"); },
  });
  const delRoutine = useMutation({
    mutationFn: (id: string) => api(`/routines/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routines"] }); toast("Routine deleted"); },
  });

  const start = () => { if (!draft) startDraft(); router.push("/train/workout"); };
  const workouts = history.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHeader title="Train" subtitle="Log a session and see how you're progressing." />
      <div className="space-y-5">
        {draft ? (
          <Card tone="lavender" className="flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-sm opacity-80">Workout in progress</div><div className="truncate font-display text-xl font-bold">{draft.title}</div><div className="display text-sm opacity-80">{draft.exercises.length} exercises</div></div>
            <Button onClick={start}><Play size={18} />Resume</Button>
          </Card>
        ) : (
          <Button className="w-full" onClick={start}><Play size={18} />Start empty workout</Button>
        )}

        <section aria-labelledby="routines-h" className="space-y-3">
          <h2 id="routines-h" className="text-[22px]">Routines</h2>
          <ErrorNote error={startRoutine.error ?? delRoutine.error} />
          {routines.isLoading ? <Skeleton className="h-24" /> : routines.data?.routines.length ? routines.data.routines.map((r) => (
            <Card key={r.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.name}</div><div className="truncate text-sm text-muted">{r.exerciseNames.slice(0, 3).join(", ")}{r.exerciseNames.length > 3 ? ` +${r.exerciseNames.length - 3}` : ""}</div></div>
              <IconButton label={`Delete ${r.name}`} onClick={() => { if (confirm(`Delete "${r.name}"?`)) delRoutine.mutate(r.id); }}><Trash2 size={18} className="text-muted" /></IconButton>
              <Button size="sm" variant="secondary" loading={startRoutine.isPending && startRoutine.variables === r.id} onClick={() => startRoutine.mutate(r.id)}>Start</Button>
            </Card>
          )) : <Empty title="No routines yet" body="Finish a workout, then save it as a routine from its summary to repeat it in one tap." />}
        </section>

        <section aria-labelledby="history-h" className="space-y-3">
          <h2 id="history-h" className="text-[22px]">History</h2>
          {history.isLoading ? <><Skeleton className="h-28" /><Skeleton className="h-28" /></> : workouts.length ? (
            <>
              {workouts.map((w) => (
                <Link key={w.id} href={`/train/w/${w.id}`} className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
                  <Card className="space-y-2">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-display text-xl font-bold">{w.title}</div><div className="text-sm text-muted">{timeAgo(w.startedAt)}</div></div><ChevronRight className="mt-1 shrink-0 text-muted" /></div>
                    <div className="flex flex-wrap gap-2"><Pill>{clock(w.durationS)}</Pill><Pill>{fmtVolume(w.totalVolumeKg, u.w)} {u.w}</Pill><Pill>{w.totalSets} sets</Pill>{w.prCount ? <Pill tone="lime"><Trophy size={14} />{w.prCount} PR{w.prCount === 1 ? "" : "s"}</Pill> : null}</div>
                    <div className="truncate text-sm text-muted">{w.exercises.map((e) => `${e.sets} × ${e.name}`).slice(0, 3).join(" · ")}</div>
                  </Card>
                </Link>
              ))}
              {history.hasNextPage ? <Button variant="secondary" className="w-full" loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>Show more</Button> : null}
            </>
          ) : <Empty title="No workouts yet" body="Your sessions will show up here with volume and PRs." />}
        </section>
      </div>
    </>
  );
}

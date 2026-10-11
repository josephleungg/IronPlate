"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Empty, ErrorNote, Field, Input, Select, Sheet, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Exercise } from "@/lib/types";

const TYPES: [string, string][] = [["weight_reps", "Weight and reps"], ["bodyweight_reps", "Bodyweight reps"], ["weighted_bodyweight", "Weighted bodyweight"], ["assisted_bodyweight", "Assisted bodyweight"], ["duration", "Duration"], ["distance_duration", "Distance and time"], ["weight_distance", "Weight and distance"]];
const EQUIP = ["barbell", "dumbbell", "machine", "cable", "kettlebell", "band", "plate", "bodyweight", "other", "none"];

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise" tall>
      {open ? <Body onPick={(e) => { onPick(e); onClose(); }} /> : null}
    </Sheet>
  );
}

function Body({ onPick }: { onPick: (e: Exercise) => void }) {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const dq = useDebounced(q.trim());
  const muscles = useQuery({ queryKey: ["muscles"], queryFn: () => api<{ data: { slug: string; name: string }[] }>("/muscle-groups"), staleTime: Infinity });
  const list = useQuery({
    queryKey: ["exercises", dq, muscle],
    queryFn: () => api<{ data: Exercise[] }>(`/exercises?limit=100${dq ? `&q=${encodeURIComponent(dq)}` : ""}${muscle ? `&muscle=${muscle}` : ""}`),
    placeholderData: (prev) => prev,
  });

  if (creating) return <CreateExercise muscles={muscles.data?.data ?? []} onCreated={onPick} onCancel={() => setCreating(false)} />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" data-autofocus /></div>
        <Button variant="secondary" className="px-3" onClick={() => setCreating(true)} aria-label="Create a custom exercise"><Plus size={20} /></Button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by muscle">
        {[{ slug: "", name: "All" }, ...(muscles.data?.data ?? [])].map((m) => (
          <button type="button" key={m.slug} onClick={() => setMuscle(m.slug)} aria-pressed={muscle === m.slug}
            className={cx("min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium", muscle === m.slug ? "border-transparent bg-primary text-primary-fg" : "border-border text-muted")}>{m.name}</button>
        ))}
      </div>
      {list.isLoading ? <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        : list.data?.data.length ? (
          <ul>{list.data.data.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)} className="flex min-h-14 w-full flex-col items-start justify-center border-b border-border py-2 text-left focus-visible:outline-2 focus-visible:outline-foreground">
                <span className="font-medium">{e.name}</span>
                <span className="text-sm capitalize text-muted">{[e.primaryMuscles.join(", ").replace(/_/g, " "), e.ownerId ? "Custom" : ""].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}</ul>
        ) : <Empty title="No exercises found" body="Try another word, or create your own with the plus button." />}
    </div>
  );
}

function CreateExercise({ muscles, onCreated, onCancel }: { muscles: { slug: string; name: string }[]; onCreated: (e: Exercise) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: "", type: "weight_reps", equipment: "barbell", muscle: "" });
  const m = useMutation({
    mutationFn: () => api<Exercise>("/exercises", { method: "POST", body: { name: f.name.trim(), exerciseType: f.type, equipment: f.equipment, primaryMuscles: f.muscle ? [f.muscle] : [] } }),
    onSuccess: onCreated,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
      <Field label="Exercise name"><Input value={f.name} onChange={set("name")} required maxLength={80} data-autofocus /></Field>
      <Field label="How do you track it?"><Select value={f.type} onChange={set("type")}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Equipment"><Select value={f.equipment} onChange={set("equipment")}>{EQUIP.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</Select></Field>
        <Field label="Main muscle"><Select value={f.muscle} onChange={set("muscle")}><option value="">Not set</option>{muscles.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</Select></Field>
      </div>
      <ErrorNote error={m.error} />
      <div className="flex gap-2"><Button variant="secondary" type="button" onClick={onCancel}>Back</Button><Button type="submit" className="flex-1" loading={m.isPending} disabled={!f.name.trim()}>Create and add</Button></div>
    </form>
  );
}

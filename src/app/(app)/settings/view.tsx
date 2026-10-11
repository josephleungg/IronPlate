"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, ErrorNote, Field, Input, Segmented, Select, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useMe, useUnits } from "@/lib/hooks";
import type { Me } from "@/lib/types";
import { convertDraft } from "@/lib/workout-store";

type System = "metric" | "imperial";

export function SettingsView() {
  const me = useMe();
  if (me.isLoading || !me.data) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  return <SettingsForm me={me.data} />;
}

function SettingsForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const router = useRouter();
  const system: System = me.settings.weightUnit === "lb" ? "imperial" : "metric";
  const signOut = useMutation({ mutationFn: () => authClient.signOut(), onSuccess: () => { qc.clear(); router.push("/sign-in"); router.refresh(); } });

  return (
    <div className="space-y-4">
      <Link href={`/u/${me.username}`} className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted"><ArrowLeft size={18} />Profile</Link>
      <h1 className="text-[32px] leading-tight">Settings</h1>
      <ProfileCard me={me} />
      <UnitsCard system={system} weightUnit={me.settings.weightUnit} liftUnit={me.settings.liftUnit} />
      {/* Keyed by unit system so the water goal re-reads in the new unit when it changes. */}
      <TargetsCard key={system} me={me} />
      <PreferencesCard me={me} />
      <Card className="space-y-3">
        <h2 className="text-[22px]">Account</h2>
        <p className="text-sm text-muted">Signed in as {me.email}</p>
        <Button variant="danger" onClick={() => signOut.mutate()} loading={signOut.isPending}>Sign out</Button>
      </Card>
    </div>
  );
}

function ProfileCard({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [p, setP] = useState({ displayName: me.profile.displayName, bio: me.profile.bio ?? "", isPrivate: me.profile.isPrivate });
  const save = useMutation({
    mutationFn: () => api("/me", { method: "PATCH", body: { displayName: p.displayName.trim(), bio: p.bio.trim() || null, isPrivate: p.isPrivate } }),
    onSuccess: () => { toast("Profile saved"); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  return (
    <Card className="space-y-4">
      <h2 className="text-[22px]">Profile</h2>
      <Field label="Display name"><Input value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} maxLength={60} /></Field>
      <Field label="Bio"><Input value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} maxLength={280} placeholder="What are you training for?" /></Field>
      <label className="flex min-h-11 items-start gap-3"><input type="checkbox" checked={p.isPrivate} onChange={(e) => setP({ ...p, isPrivate: e.target.checked })} className="mt-0.5 size-5 accent-[#14213d]" /><span><span className="block">Private account</span><span className="block text-sm text-muted">People need your approval to follow you, and your workouts stay out of Discover.</span></span></label>
      <ErrorNote error={save.error} />
      <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!p.displayName.trim()}>Save profile</Button>
    </Card>
  );
}

type LiftChoice = "same" | "kg" | "lb";

/** The one switch for the whole app, plus an optional separate unit for lifting weights. Saves immediately. */
function UnitsCard({ system, weightUnit, liftUnit }: { system: System; weightUnit: "kg" | "lb"; liftUnit: "kg" | "lb" | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const effectiveLift = liftUnit ?? weightUnit;

  const change = useMutation({
    mutationFn: (to: System) => api("/me/settings", { method: "PATCH", body: { weightUnit: to === "imperial" ? "lb" : "kg", distanceUnit: to === "imperial" ? "mi" : "km" } }),
    onSuccess: async (_r, to) => {
      const newWeight = to === "imperial" ? "lb" : "kg";
      // Lifting weights only move with the main switch when they follow it (liftUnit is null).
      const newLift = liftUnit ?? newWeight;
      convertDraft({ distance: to === "imperial" ? "mi" : "km", weight: newLift !== effectiveLift ? newLift : undefined });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast(to === "imperial" ? "Switched to imperial units" : "Switched to metric units");
    },
  });

  const changeLift = useMutation({
    mutationFn: (choice: LiftChoice) => api("/me/settings", { method: "PATCH", body: { liftUnit: choice === "same" ? null : choice } }),
    onSuccess: async (_r, choice) => {
      const newLift = choice === "same" ? weightUnit : choice;
      if (newLift !== effectiveLift) convertDraft({ weight: newLift });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast(choice === "same" ? "Workout weights follow your units" : `Workout weights now in ${choice === "kg" ? "kilograms" : "pounds"}`);
    },
  });

  return (
    <Card className="space-y-4">
      <h2 className="text-[22px]">Units</h2>
      <Segmented<System> value={system} onChange={(v) => { if (v !== system) change.mutate(v); }} options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} />
      <p className="text-sm text-muted">{system === "metric" ? "Body weight in kg, distances in km, water in ml." : "Body weight in lb, distances in miles, water in fluid ounces."} Food amounts stay in grams, as on nutrition labels.</p>
      <Field label="Weights for workouts" hint="Lets you log lifts in kg or lb no matter which system you use for everything else.">
        <Select value={liftUnit ?? "same"} onChange={(e) => changeLift.mutate(e.target.value as LiftChoice)} disabled={changeLift.isPending}>
          <option value="same">Same as my units ({weightUnit === "lb" ? "pounds" : "kilograms"})</option>
          <option value="kg">Kilograms (kg)</option>
          <option value="lb">Pounds (lb)</option>
        </Select>
      </Field>
      <ErrorNote error={change.error ?? changeLift.error} />
    </Card>
  );
}

function TargetsCard({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const u = useUnits();
  const [g, setG] = useState({
    calories: String(me.goal?.calories ?? ""), proteinG: String(me.goal?.proteinG ?? ""), carbsG: String(me.goal?.carbsG ?? ""), fatG: String(me.goal?.fatG ?? ""),
    water: String(Math.round(u.vol(me.goal?.waterMl ?? 2500))),
  });
  const save = useMutation({
    mutationFn: () => api("/goals/nutrition", { method: "PUT", body: { calories: Math.round(Number(g.calories)), proteinG: Number(g.proteinG), carbsG: Number(g.carbsG), fatG: Number(g.fatG), waterMl: Math.round(u.volToMl(Number(g.water) || 0)) || 2500 } }),
    onSuccess: () => { toast("Daily targets saved"); qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["day"] }); },
  });
  return (
    <Card className="space-y-4">
      <h2 className="text-[22px]">Daily targets</h2>
      <Field label="Calories"><Input inputMode="numeric" value={g.calories} onChange={(e) => setG({ ...g, calories: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein g"><Input inputMode="numeric" value={g.proteinG} onChange={(e) => setG({ ...g, proteinG: e.target.value })} /></Field>
        <Field label="Carbs g"><Input inputMode="numeric" value={g.carbsG} onChange={(e) => setG({ ...g, carbsG: e.target.value })} /></Field>
        <Field label="Fat g"><Input inputMode="numeric" value={g.fatG} onChange={(e) => setG({ ...g, fatG: e.target.value })} /></Field>
      </div>
      <Field label={`Water goal (${u.volUnit})`}><Input inputMode="numeric" value={g.water} onChange={(e) => setG({ ...g, water: e.target.value })} /></Field>
      <ErrorNote error={save.error} />
      <Button onClick={() => save.mutate()} loading={save.isPending}>Save targets</Button>
    </Card>
  );
}

function PreferencesCard({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState({ defaultWorkoutVisibility: me.settings.defaultWorkoutVisibility as string, weekStart: String(me.settings.weekStart) });
  const save = useMutation({
    mutationFn: () => api("/me/settings", { method: "PATCH", body: { defaultWorkoutVisibility: s.defaultWorkoutVisibility, weekStart: Number(s.weekStart) } }),
    onSuccess: () => { toast("Preferences saved"); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  return (
    <Card className="space-y-4">
      <h2 className="text-[22px]">Preferences</h2>
      <Field label="Workouts are shared with"><Select value={s.defaultWorkoutVisibility} onChange={(e) => setS({ ...s, defaultWorkoutVisibility: e.target.value })}><option value="private">Only me</option><option value="followers">Followers</option><option value="public">Everyone</option></Select></Field>
      <Field label="Week starts on"><Select value={s.weekStart} onChange={(e) => setS({ ...s, weekStart: e.target.value })}><option value="1">Monday</option><option value="0">Sunday</option></Select></Field>
      <ErrorNote error={save.error} />
      <Button onClick={() => save.mutate()} loading={save.isPending}>Save preferences</Button>
    </Card>
  );
}

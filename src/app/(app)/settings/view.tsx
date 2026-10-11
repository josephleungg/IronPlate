"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, ErrorNote, Field, Input, Select, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useMe } from "@/lib/hooks";
import type { Me } from "@/lib/types";

export function SettingsView() {
  const me = useMe();
  if (me.isLoading || !me.data) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  return <SettingsForm me={me.data} />;
}

function SettingsForm({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  // Initial values come from the loaded profile; the form owns its state from here on.
  const [p, setP] = useState({ displayName: me.profile.displayName, bio: me.profile.bio ?? "", isPrivate: me.profile.isPrivate });
  const [s, setS] = useState<{ weightUnit: string; distanceUnit: string; diaryVisibility: string; defaultWorkoutVisibility: string; weekStart: string }>({
    weightUnit: me.settings.weightUnit, distanceUnit: me.settings.distanceUnit, diaryVisibility: me.settings.diaryVisibility,
    defaultWorkoutVisibility: me.settings.defaultWorkoutVisibility, weekStart: String(me.settings.weekStart),
  });
  const [g, setG] = useState({
    calories: String(me.goal?.calories ?? ""), proteinG: String(me.goal?.proteinG ?? ""), carbsG: String(me.goal?.carbsG ?? ""),
    fatG: String(me.goal?.fatG ?? ""), waterMl: String(me.goal?.waterMl ?? 2500),
  });

  const done = (msg: string) => () => { toast(msg); qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["day"] }); };
  const saveProfile = useMutation({ mutationFn: () => api("/me", { method: "PATCH", body: { displayName: p.displayName.trim(), bio: p.bio.trim() || null, isPrivate: p.isPrivate } }), onSuccess: done("Profile saved") });
  const saveSettings = useMutation({ mutationFn: () => api("/me/settings", { method: "PATCH", body: { ...s, weekStart: Number(s.weekStart) } }), onSuccess: done("Preferences saved") });
  const saveGoals = useMutation({ mutationFn: () => api("/goals/nutrition", { method: "PUT", body: { calories: Math.round(Number(g.calories)), proteinG: Number(g.proteinG), carbsG: Number(g.carbsG), fatG: Number(g.fatG), waterMl: Math.round(Number(g.waterMl) || 2500) } }), onSuccess: done("Daily targets saved") });
  const signOut = useMutation({ mutationFn: () => authClient.signOut(), onSuccess: () => { qc.clear(); router.push("/sign-in"); router.refresh(); } });

  return (
    <div className="space-y-4">
      <Link href={`/u/${me.username}`} className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted"><ArrowLeft size={18} />Profile</Link>
      <h1 className="text-[32px] leading-tight">Settings</h1>

      <Card className="space-y-4">
        <h2 className="text-[22px]">Profile</h2>
        <Field label="Display name"><Input value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} maxLength={60} /></Field>
        <Field label="Bio"><Input value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} maxLength={280} placeholder="What are you training for?" /></Field>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" checked={p.isPrivate} onChange={(e) => setP({ ...p, isPrivate: e.target.checked })} className="mt-0.5 size-5 accent-[#14213d]" /><span><span className="block">Private account</span><span className="block text-sm text-muted">People need your approval to follow you, and your workouts stay out of Discover.</span></span></label>
        <ErrorNote error={saveProfile.error} />
        <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={!p.displayName.trim()}>Save profile</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[22px]">Daily targets</h2>
        <Field label="Calories"><Input inputMode="numeric" value={g.calories} onChange={(e) => setG({ ...g, calories: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Protein g"><Input inputMode="numeric" value={g.proteinG} onChange={(e) => setG({ ...g, proteinG: e.target.value })} /></Field>
          <Field label="Carbs g"><Input inputMode="numeric" value={g.carbsG} onChange={(e) => setG({ ...g, carbsG: e.target.value })} /></Field>
          <Field label="Fat g"><Input inputMode="numeric" value={g.fatG} onChange={(e) => setG({ ...g, fatG: e.target.value })} /></Field>
        </div>
        <Field label="Water goal (ml)"><Input inputMode="numeric" value={g.waterMl} onChange={(e) => setG({ ...g, waterMl: e.target.value })} /></Field>
        <ErrorNote error={saveGoals.error} />
        <Button onClick={() => saveGoals.mutate()} loading={saveGoals.isPending}>Save targets</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[22px]">Preferences</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight"><Select value={s.weightUnit} onChange={(e) => setS({ ...s, weightUnit: e.target.value })}><option value="kg">Kilograms</option><option value="lb">Pounds</option></Select></Field>
          <Field label="Distance"><Select value={s.distanceUnit} onChange={(e) => setS({ ...s, distanceUnit: e.target.value })}><option value="km">Kilometres</option><option value="mi">Miles</option></Select></Field>
        </div>
        <Field label="Workouts are shared with"><Select value={s.defaultWorkoutVisibility} onChange={(e) => setS({ ...s, defaultWorkoutVisibility: e.target.value })}><option value="private">Only me</option><option value="followers">Followers</option><option value="public">Everyone</option></Select></Field>
        <Field label="Week starts on"><Select value={s.weekStart} onChange={(e) => setS({ ...s, weekStart: e.target.value })}><option value="1">Monday</option><option value="0">Sunday</option></Select></Field>
        <ErrorNote error={saveSettings.error} />
        <Button onClick={() => saveSettings.mutate()} loading={saveSettings.isPending}>Save preferences</Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-[22px]">Account</h2>
        <p className="text-sm text-muted">Signed in as {me.email}</p>
        <Button variant="danger" onClick={() => signOut.mutate()} loading={signOut.isPending}>Sign out</Button>
      </Card>
    </div>
  );
}

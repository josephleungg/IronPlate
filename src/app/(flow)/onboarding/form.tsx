"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button, Card, ErrorNote, Field, Input, Pill, Segmented, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { lbToKg } from "@/lib/domain/units";
import { n0 } from "@/lib/format";

type Rec = { calories: number; proteinG: number; carbsG: number; fatG: number; tdee: number; warnings: string[] };

export function OnboardingForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [units, setUnits] = useState<"kg" | "lb">("kg");
  const [f, setF] = useState({ sex: "unspecified", birthDate: "", height: "", feet: "", inches: "", weight: "", activityLevel: "light", goal: "maintain", rate: "0.5", target: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Rec | null>(null);
  const [goal, setGoal] = useState({ calories: "", proteinG: "", carbsG: "", fatG: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const heightCm = units === "kg" ? Number(f.height) : (Number(f.feet) * 12 + Number(f.inches || 0)) * 2.54;
      const weightKg = units === "kg" ? Number(f.weight) : lbToKg(Number(f.weight));
      const rate = units === "kg" ? Number(f.rate) : lbToKg(Number(f.rate));
      const out = await api<{ recommendation: Rec }>("/me/onboarding", {
        method: "POST",
        body: {
          sex: f.sex, birthDate: f.birthDate, heightCm: Math.round(heightCm), weightKg: Math.round(weightKg * 10) / 10,
          activityLevel: f.activityLevel, goal: f.goal, weeklyRateKg: f.goal === "maintain" ? 0 : Math.round(rate * 100) / 100,
          targetWeightKg: f.goal !== "maintain" && Number(f.target) > 0 ? Math.round((units === "kg" ? Number(f.target) : lbToKg(Number(f.target))) * 10) / 10 : undefined,
          weightUnit: units, distanceUnit: units === "kg" ? "km" : "mi", timezone: tz,
        },
      });
      setRec(out.recommendation);
      setGoal({ calories: String(out.recommendation.calories), proteinG: String(out.recommendation.proteinG), carbsG: String(out.recommendation.carbsG), fatG: String(out.recommendation.fatG) });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api("/goals/nutrition", { method: "PUT", body: { calories: Math.round(Number(goal.calories)), proteinG: Number(goal.proteinG), carbsG: Number(goal.carbsG), fatG: Number(goal.fatG), waterMl: 2500 } });
      await qc.invalidateQueries();
      router.push("/diary");
      router.refresh();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (rec) {
    return (
      <>
        <div className="space-y-2"><Logo /><h1 className="text-[32px] leading-tight">Your daily targets</h1><p className="text-muted">Based on what you told us. Adjust them any time.</p></div>
        <Card tone="hero" className="space-y-1">
          <div className="text-sm text-hero-muted">Maintenance is about {n0(rec.tdee)} kcal</div>
          <div className="display text-5xl">{n0(Number(goal.calories) || 0)}<span className="ml-2 text-base font-medium text-hero-muted">kcal a day</span></div>
        </Card>
        {rec.warnings.map((w) => <Card key={w} tone="lavender" className="text-sm">{w}</Card>)}
        <Card className="space-y-4">
          <Field label="Calories"><Input inputMode="numeric" value={goal.calories} onChange={(e) => setGoal({ ...goal, calories: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Protein g"><Input inputMode="numeric" value={goal.proteinG} onChange={(e) => setGoal({ ...goal, proteinG: e.target.value })} /></Field>
            <Field label="Carbs g"><Input inputMode="numeric" value={goal.carbsG} onChange={(e) => setGoal({ ...goal, carbsG: e.target.value })} /></Field>
            <Field label="Fat g"><Input inputMode="numeric" value={goal.fatG} onChange={(e) => setGoal({ ...goal, fatG: e.target.value })} /></Field>
          </div>
          <ErrorNote error={error} />
          <Button onClick={finish} loading={busy} className="w-full">Looks good</Button>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2"><Logo /><h1 className="text-[32px] leading-tight">Let&apos;s set you up</h1><p className="text-muted">A few details so we can suggest daily targets. They stay private.</p></div>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Segmented value={units} onChange={setUnits} options={[{ value: "kg", label: "Metric (kg, cm)" }, { value: "lb", label: "Imperial (lb, ft)" }]} />
          <Field label="Sex" hint="Used only for the calorie formula.">
            <Select value={f.sex} onChange={set("sex")}><option value="unspecified">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option></Select>
          </Field>
          <Field label="Date of birth"><Input type="date" value={f.birthDate} onChange={set("birthDate")} max={new Date().toISOString().slice(0, 10)} required /></Field>
          {units === "kg" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (cm)"><Input inputMode="decimal" value={f.height} onChange={set("height")} required /></Field>
              <Field label="Weight (kg)"><Input inputMode="decimal" value={f.weight} onChange={set("weight")} required /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Height (ft)"><Input inputMode="numeric" value={f.feet} onChange={set("feet")} required /></Field>
              <Field label="(in)"><Input inputMode="numeric" value={f.inches} onChange={set("inches")} /></Field>
              <Field label="Weight (lb)"><Input inputMode="decimal" value={f.weight} onChange={set("weight")} required /></Field>
            </div>
          )}
          <Field label="How active are you?">
            <Select value={f.activityLevel} onChange={set("activityLevel")}>
              <option value="sedentary">Mostly sitting</option><option value="light">Light: 1 to 3 workouts a week</option><option value="moderate">Moderate: 3 to 5 a week</option><option value="active">Active: 6 to 7 a week</option><option value="very_active">Very active: physical job and training</option>
            </Select>
          </Field>
          <Field label="Your goal">
            <Segmented value={f.goal} onChange={(v) => setF((s) => ({ ...s, goal: v }))} options={[{ value: "lose", label: "Lose" }, { value: "maintain", label: "Maintain" }, { value: "gain", label: "Gain" }]} />
          </Field>
          {f.goal !== "maintain" ? (
            <Field label={`Pace (${units} per week)`} hint="Slower is easier to keep up.">
              <Select value={f.rate} onChange={set("rate")}>{(units === "kg" ? ["0.25", "0.5", "0.75"] : ["0.5", "1", "1.5"]).map((r) => <option key={r} value={r}>{r} {units} a week</option>)}</Select>
            </Field>
          ) : null}
          {f.goal !== "maintain" ? <Field label={`Goal weight (${units}), optional`}><Input inputMode="decimal" value={f.target} onChange={set("target")} /></Field> : null}
          <ErrorNote error={error} />
          <Button type="submit" loading={busy} className="w-full">Continue</Button>
        </form>
      </Card>
      <p className="text-center"><Pill>Your timezone: {tz}</Pill></p>
    </>
  );
}

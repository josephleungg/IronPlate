"use client";
import { useSyncExternalStore } from "react";
import { kgToLb, kmToMi, lbToKg, miToKm } from "./domain/units";
import { uuidv7 } from "./id";
import type { ExerciseType, SetType } from "./types";

/** In-progress workout. Lives in localStorage so a refresh, a lost signal or a dead battery never loses it. */
export type DraftSet = { id: string; setType: SetType; weight: string; reps: string; duration: string; distance: string; done: boolean };
export type DraftExercise = { key: string; exerciseId: string; name: string; type: ExerciseType; restSeconds: number | null; sets: DraftSet[] };
export type Draft = { id: string; title: string; startedAt: number; routineId: string | null; exercises: DraftExercise[]; restEndsAt: number | null; restTotal: number };

const KEY = "ironplate:workout-draft:v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Draft | null } = { raw: null, value: null };

function read(): Draft | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { return cache.value; }
  if (raw === cache.raw) return cache.value;
  let value: Draft | null = null;
  try { value = raw ? (JSON.parse(raw) as Draft) : null; } catch { value = null; }
  cache = { raw, value };
  return value;
}

function write(d: Draft | null) {
  try {
    if (d) window.localStorage.setItem(KEY, JSON.stringify(d));
    else window.localStorage.removeItem(KEY);
  } catch { /* storage unavailable: keep in memory only */ }
  cache = { raw: d ? JSON.stringify(d) : null, value: d };
  listeners.forEach((l) => l());
}

export function useDraft(): Draft | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    read,
    () => null,
  );
}

export const getDraft = read;

/** Set while finishing a workout, so the logger doesn't redirect to /train when the draft is cleared. */
export const nav: { to: string | null } = { to: null };

export function defaultTitle(at = new Date()) {
  const h = at.getHours();
  return h < 12 ? "Morning workout" : h < 17 ? "Afternoon workout" : "Evening workout";
}
export const clearDraft = () => write(null);
export function updateDraft(fn: (d: Draft) => Draft) {
  const d = read();
  if (d) write(fn(d));
}

export const newSet = (over: Partial<DraftSet> = {}): DraftSet => ({ id: uuidv7(), setType: "normal", weight: "", reps: "", duration: "", distance: "", done: false, ...over });

export function startDraft(init: Partial<Pick<Draft, "title" | "routineId" | "exercises">> = {}): Draft {
  const d: Draft = { id: uuidv7(), title: init.title ?? defaultTitle(), startedAt: Date.now(), routineId: init.routineId ?? null, exercises: init.exercises ?? [], restEndsAt: null, restTotal: 0 };
  write(d);
  return d;
}

export const newExercise = (e: { id: string; name: string; type: ExerciseType }, sets = 3): DraftExercise => ({
  key: uuidv7(), exerciseId: e.id, name: e.name, type: e.type, restSeconds: null, sets: Array.from({ length: sets }, () => newSet()),
});

/**
 * A workout in progress stores numbers as typed, in the user's units. When a unit changes
 * mid-session, convert them so "80" kg never silently becomes "80" lb. Pass only the units that changed.
 */
export function convertDraft(to: { weight?: "kg" | "lb"; distance?: "km" | "mi" }) {
  if (!read()) return;
  const r1 = (n: number) => String(Math.round(n * 10) / 10);
  // Three decimals for distance so flipping back and forth does not drift.
  const r3 = (n: number) => String(Math.round(n * 1000) / 1000);
  const num = (v: string) => v !== "" && Number.isFinite(Number(v));
  updateDraft((d) => ({
    ...d,
    exercises: d.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => ({
        ...s,
        weight: to.weight && num(s.weight) ? r1(to.weight === "lb" ? kgToLb(Number(s.weight)) : lbToKg(Number(s.weight))) : s.weight,
        distance: to.distance && num(s.distance) ? r3(to.distance === "mi" ? kmToMi(Number(s.distance)) : miToKm(Number(s.distance))) : s.distance,
      })),
    })),
  }));
}

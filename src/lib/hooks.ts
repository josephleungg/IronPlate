"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { fmtWeight, weightIn, weightOut, distanceIn, distanceOut, mlToFloz, flozToMl } from "./format";
import type { Me } from "./types";
import { localDate } from "./domain/dates";

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), staleTime: 60_000 });

/** Unit helpers bound to the signed-in user's settings (defaults to metric until loaded). */
export function useUnits() {
  const { data } = useMe();
  const w = data?.settings.weightUnit ?? "kg";
  const d = data?.settings.distanceUnit ?? "km";
  // One switch drives everything: pounds means imperial (miles, fluid ounces), kilograms means metric.
  const imperial = w === "lb";
  // Lifting weights can use their own unit; body weight (show/toKg/fmt/w) always follows the main one.
  const lift = data?.settings.liftUnit ?? w;
  return {
    w, d, imperial, lift,
    liftShow: (kg: number) => weightIn(kg, lift),
    liftToKg: (v: number) => weightOut(v, lift), tz: data?.settings.timezone ?? "UTC",
    volUnit: imperial ? "fl oz" : "ml",
    vol: (ml: number) => (imperial ? mlToFloz(ml) : ml),
    volToMl: (v: number) => (imperial ? flozToMl(v) : v),
    fmt: (kg: number) => fmtWeight(kg, w),
    show: (kg: number) => weightIn(kg, w),
    toKg: (v: number) => weightOut(v, w),
    distShow: (m: number) => distanceIn(m, d),
    distToM: (v: number) => distanceOut(v, d),
  };
}

export function useToday() {
  const { tz } = useUnits();
  return localDate(tz);
}

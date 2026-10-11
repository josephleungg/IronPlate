"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, ErrorNote, Field, Input, Select, Sheet } from "@/components/ui";
import { api } from "@/lib/api";
import { nutrientsForAmount } from "@/lib/domain/nutrition";
import { n0 } from "@/lib/format";
import type { Entry, Food } from "@/lib/types";

export function EditEntrySheet({ entry, onClose, onChanged }: { entry: Entry | null; onClose: () => void; onChanged: () => void }) {
  return (
    <Sheet open={Boolean(entry)} onClose={onClose} title="Edit entry">
      {entry ? <Body key={entry.id} entry={entry} onClose={onClose} onChanged={onChanged} /> : null}
    </Sheet>
  );
}

function Body({ entry, onClose, onChanged }: { entry: Entry; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const food = useQuery({ queryKey: ["food", entry.foodId], queryFn: () => api<Food>(`/foods/${entry.foodId}`), enabled: Boolean(entry.foodId) });
  const [servings, setServings] = useState(String(entry.servings));
  const [servingId, setServingId] = useState(entry.servingId ?? "");
  const [kcal, setKcal] = useState(String(entry.kcal));

  const serving = food.data?.servings.find((s) => s.id === servingId) ?? food.data?.servings[0];
  const qty = Number(servings);
  const preview = food.data && serving && qty > 0 ? nutrientsForAmount(food.data, serving.amount * qty) : null;

  const save = useMutation({
    mutationFn: () => api(`/diary/entries/${entry.id}`, { method: "PATCH", body: entry.foodId ? { servings: qty, servingId: serving?.id } : { kcal: Number(kcal) } }),
    onSuccess: () => { onChanged(); onClose(); toast("Saved"); },
  });
  const del = useMutation({
    mutationFn: () => api(`/diary/entries/${entry.id}`, { method: "DELETE" }),
    onSuccess: () => { onChanged(); onClose(); toast("Entry removed"); },
  });

  return (
    <div className="space-y-4">
      <div><div className="text-lg font-medium">{entry.name}</div>{entry.brand ? <div className="text-sm text-muted">{entry.brand}</div> : null}</div>
      {entry.foodId ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serving"><Select value={serving?.id ?? ""} onChange={(e) => setServingId(e.target.value)} disabled={!food.data}>{food.data?.servings.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          <Field label="How many"><Input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
        </div>
      ) : (
        <Field label="Calories"><Input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field>
      )}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[["kcal", preview?.kcal ?? entry.kcal], ["Protein", preview?.proteinG ?? entry.proteinG], ["Carbs", preview?.carbsG ?? entry.carbsG], ["Fat", preview?.fatG ?? entry.fatG]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-track py-2"><div className="display text-lg">{n0(v as number)}</div><div className="text-xs text-muted">{l}</div></div>
        ))}
      </div>
      <ErrorNote error={save.error ?? del.error} />
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => del.mutate()} loading={del.isPending}>Remove</Button>
        <Button className="flex-1" onClick={() => save.mutate()} loading={save.isPending} disabled={entry.foodId ? !(qty > 0) : !(Number(kcal) >= 0)}>Save</Button>
      </div>
    </div>
  );
}

"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScanBarcode, Search, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, Empty, ErrorNote, Field, Input, Segmented, Select, Sheet, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { nutrientsForAmount } from "@/lib/domain/nutrition";
import { n0 } from "@/lib/format";
import type { Food } from "@/lib/types";

type Source = "search" | "barcode" | "recent" | "ai_text";
type Tab = "find" | "recent" | "quick" | "create" | "describe";
type Suggestion = { text: string; food: Food | null; servingId: string | null; servings: number };

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

const defaultServing = (f: Food) => f.servings.find((s) => s.isDefault) ?? f.servings[0];

export function AddFoodSheet({ open, slot, date, onClose, onAdded }: { open: boolean; slot: { id: string; name: string } | null; date: string; onClose: () => void; onAdded: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={slot ? `Add to ${slot.name.toLowerCase()}` : "Add food"} tall>
      {slot ? <Body slot={slot} date={date} onClose={onClose} onAdded={onAdded} /> : null}
    </Sheet>
  );
}

function Body({ slot, date, onClose, onAdded }: { slot: { id: string; name: string }; date: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const health = useQuery({ queryKey: ["health"], queryFn: () => api<{ ai: boolean }>("/health").catch(() => ({ ai: false })), staleTime: 300_000 });
  const [tab, setTab] = useState<Tab>("find");
  const [picked, setPicked] = useState<{ food: Food; source: Source } | null>(null);

  const add = useMutation({
    mutationFn: (v: { foodId: string; servingId?: string; servings: number; source: Source }) =>
      api(`/diary/${date}/entries`, { method: "POST", body: { mealSlotId: slot.id, ...v } }),
  });
  const finish = (name: string) => { onAdded(); toast(`Added ${name}`); onClose(); };

  if (picked) {
    return <ServingStep food={picked.food} onBack={() => setPicked(null)} busy={add.isPending} error={add.error}
      onAdd={(servingId, servings) => add.mutate({ foodId: picked.food.id, servingId, servings, source: picked.source }, { onSuccess: () => finish(picked.food.name) })} />;
  }

  const tabs: { value: Tab; label: string }[] = [{ value: "find", label: "Search" }, { value: "recent", label: "Recent" }, { value: "quick", label: "Quick add" }, { value: "create", label: "New food" }];
  if (health.data?.ai) tabs.push({ value: "describe", label: "Describe" });

  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1"><Segmented value={tab} onChange={setTab} options={tabs} className="min-w-max" /></div>
      {tab === "find" ? <FindTab onPick={(food, source) => setPicked({ food, source })} /> : null}
      {tab === "recent" ? <RecentTab onPick={(food) => setPicked({ food, source: "recent" })} /> : null}
      {tab === "quick" ? <QuickTab slotId={slot.id} date={date} onDone={() => finish("quick entry")} /> : null}
      {tab === "create" ? <CreateTab onCreated={(food) => setPicked({ food, source: "search" })} /> : null}
      {tab === "describe" ? <DescribeTab slotId={slot.id} date={date} onDone={(n) => finish(`${n} item${n === 1 ? "" : "s"}`)} /> : null}
    </div>
  );
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const s = defaultServing(food);
  const n = s ? nutrientsForAmount(food, s.amount) : null;
  return (
    <li>
      <button onClick={onClick} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border py-2 text-left focus-visible:outline-2 focus-visible:outline-foreground">
        <span className="min-w-0"><span className="block truncate">{food.name}</span><span className="block truncate text-sm text-muted">{[food.brand, s?.label].filter(Boolean).join(" · ")}</span></span>
        <span className="display shrink-0 text-base">{n ? n0(n.kcal) : n0(food.kcal100)}<span className="ml-0.5 text-xs font-medium text-muted">kcal</span></span>
      </button>
    </li>
  );
}

function FindTab({ onPick }: { onPick: (f: Food, s: Source) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [barcode, setBarcode] = useState(false);
  const [code, setCode] = useState("");
  const results = useQuery({ queryKey: ["foods", "search", dq], queryFn: () => api<{ data: Food[] }>(`/foods/search?q=${encodeURIComponent(dq)}`), enabled: dq.length > 0 });
  const lookup = useMutation({ mutationFn: (c: string) => api<Food>(`/foods/barcode/${encodeURIComponent(c)}`), onSuccess: (f) => onPick(f, "barcode") });
  const submitCode = (e: FormEvent) => { e.preventDefault(); lookup.mutate(code.trim()); };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input aria-label="Search foods" placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" data-autofocus /></div>
        <Button variant={barcode ? "primary" : "secondary"} className="px-3" onClick={() => setBarcode((b) => !b)} aria-label="Look up a barcode" aria-pressed={barcode}><ScanBarcode size={20} /></Button>
      </div>
      {barcode ? (
        <form onSubmit={submitCode} className="space-y-2">
          <div className="flex gap-2"><Input aria-label="Barcode number" placeholder="Barcode number" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /><Button type="submit" loading={lookup.isPending} disabled={code.trim().length < 8}>Look up</Button></div>
          <ErrorNote error={lookup.error} />
        </form>
      ) : null}
      {!dq ? <Empty icon={<Search />} title="Find a food" body="Search by name or brand. Can't find it? Use New food, or look up a barcode." /> : results.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : results.data?.data.length ? (
        <ul>{results.data.data.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f, "search")} />)}</ul>
      ) : (
        <Empty title="No matches" body="Try a simpler word, or create the food yourself in New food." />
      )}
    </div>
  );
}

function RecentTab({ onPick }: { onPick: (f: Food) => void }) {
  const recent = useQuery({ queryKey: ["foods", "recent"], queryFn: () => api<{ data: Food[] }>("/foods/recent") });
  if (recent.isLoading) return <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  if (!recent.data?.data.length) return <Empty title="No recent foods yet" body="Foods you log show up here for one-tap access." />;
  return <ul>{recent.data.data.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}</ul>;
}

function ServingStep({ food, onBack, onAdd, busy, error }: { food: Food; onBack: () => void; onAdd: (servingId: string | undefined, servings: number) => void; busy: boolean; error: unknown }) {
  const [servingId, setServingId] = useState(defaultServing(food)?.id ?? "");
  const [qty, setQty] = useState("1");
  const serving = food.servings.find((s) => s.id === servingId) ?? food.servings[0];
  const q = Number(qty);
  const n = serving && q > 0 ? nutrientsForAmount(food, serving.amount * q) : null;
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3"><ArrowLeft size={18} />Back</Button>
      <div><div className="text-lg font-medium">{food.name}</div>{food.brand ? <div className="text-sm text-muted">{food.brand}</div> : null}</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Serving"><Select value={servingId} onChange={(e) => setServingId(e.target.value)}>{food.servings.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
        <Field label="How many"><Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      </div>
      <Card tone="hero" className="grid grid-cols-4 gap-2 text-center">
        {[["kcal", n?.kcal], ["Protein", n?.proteinG], ["Carbs", n?.carbsG], ["Fat", n?.fatG]].map(([l, v]) => (
          <div key={l as string}><div className="display text-2xl">{v === undefined ? "–" : n0(v as number)}</div><div className="text-xs text-hero-muted">{l}</div></div>
        ))}
      </Card>
      <ErrorNote error={error} />
      <Button className="w-full" loading={busy} disabled={!(q > 0)} onClick={() => onAdd(serving?.id, q)}>Add to diary</Button>
    </div>
  );
}

function QuickTab({ slotId, date, onDone }: { slotId: string; date: string; onDone: () => void }) {
  const [f, setF] = useState({ name: "", kcal: "", p: "", c: "", fat: "" });
  const m = useMutation({
    mutationFn: () => api(`/diary/${date}/quick-add`, { method: "POST", body: { mealSlotId: slotId, name: f.name.trim() || "Quick add", kcal: Number(f.kcal), proteinG: Number(f.p || 0), carbsG: Number(f.c || 0), fatG: Number(f.fat || 0) } }),
    onSuccess: onDone,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
      <Field label="Name (optional)"><Input value={f.name} onChange={set("name")} placeholder="Restaurant lunch" maxLength={80} /></Field>
      <Field label="Calories"><Input inputMode="numeric" value={f.kcal} onChange={set("kcal")} required /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein g"><Input inputMode="decimal" value={f.p} onChange={set("p")} /></Field>
        <Field label="Carbs g"><Input inputMode="decimal" value={f.c} onChange={set("c")} /></Field>
        <Field label="Fat g"><Input inputMode="decimal" value={f.fat} onChange={set("fat")} /></Field>
      </div>
      <ErrorNote error={m.error} />
      <Button type="submit" className="w-full" loading={m.isPending} disabled={!(Number(f.kcal) >= 0) || !f.kcal}>Add</Button>
    </form>
  );
}

function CreateTab({ onCreated }: { onCreated: (f: Food) => void }) {
  const [f, setF] = useState({ name: "", brand: "", unit: "g", kcal: "", p: "", c: "", fat: "", servingLabel: "", servingAmount: "" });
  const m = useMutation({
    mutationFn: () => api<Food>("/foods", {
      method: "POST",
      body: {
        name: f.name.trim(), brand: f.brand.trim() || undefined, baseUnit: f.unit, kcal100: Number(f.kcal), protein100: Number(f.p || 0), carbs100: Number(f.c || 0), fat100: Number(f.fat || 0),
        servings: f.servingLabel && Number(f.servingAmount) > 0 ? [{ label: f.servingLabel.trim(), amount: Number(f.servingAmount) }] : [],
      },
    }),
    onSuccess: onCreated,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
      <p className="text-sm text-muted">Enter the numbers from the label, per 100 {f.unit}. Only you can see foods you create.</p>
      <Field label="Name"><Input value={f.name} onChange={set("name")} required maxLength={120} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand (optional)"><Input value={f.brand} onChange={set("brand")} maxLength={80} /></Field>
        <Field label="Per 100"><Select value={f.unit} onChange={set("unit")}><option value="g">grams</option><option value="ml">millilitres</option></Select></Field>
      </div>
      <Field label={`Calories per 100 ${f.unit}`}><Input inputMode="decimal" value={f.kcal} onChange={set("kcal")} required /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein g"><Input inputMode="decimal" value={f.p} onChange={set("p")} /></Field>
        <Field label="Carbs g"><Input inputMode="decimal" value={f.c} onChange={set("c")} /></Field>
        <Field label="Fat g"><Input inputMode="decimal" value={f.fat} onChange={set("fat")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Serving name"><Input value={f.servingLabel} onChange={set("servingLabel")} placeholder="1 bar" /></Field>
        <Field label={`Serving size (${f.unit})`}><Input inputMode="decimal" value={f.servingAmount} onChange={set("servingAmount")} /></Field>
      </div>
      <ErrorNote error={m.error} />
      <Button type="submit" className="w-full" loading={m.isPending} disabled={!f.name.trim() || !f.kcal}>Create and add</Button>
    </form>
  );
}

function DescribeTab({ slotId, date, onDone }: { slotId: string; date: string; onDone: (n: number) => void }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const parse = useMutation({ mutationFn: () => api<{ data: Suggestion[] }>("/ai/food/parse", { method: "POST", body: { text } }), onSuccess: (r) => setItems(r.data) });
  const addAll = useMutation({
    mutationFn: async () => {
      const ok = (items ?? []).filter((i) => i.food);
      for (const i of ok) await api(`/diary/${date}/entries`, { method: "POST", body: { mealSlotId: slotId, foodId: i.food!.id, servingId: i.servingId ?? undefined, servings: Math.max(0.01, i.servings), source: "ai_text" } });
      return ok.length;
    },
    onSuccess: onDone,
  });
  if (items) {
    const matched = items.filter((i) => i.food);
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Check these before adding. Anything we couldn&apos;t match is skipped.</p>
        <ul>{items.map((i, idx) => (
          <li key={idx} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
            <span className="min-w-0"><span className="block truncate font-medium">{i.food?.name ?? i.text}</span><span className="text-muted">{i.food ? `${Math.round(i.servings * 100) / 100} × ${i.food.servings.find((s) => s.id === i.servingId)?.label ?? "serving"}` : "No match"}</span></span>
          </li>
        ))}</ul>
        <ErrorNote error={addAll.error} />
        <div className="flex gap-2"><Button variant="secondary" onClick={() => setItems(null)}>Edit text</Button><Button className="flex-1" loading={addAll.isPending} disabled={!matched.length} onClick={() => addAll.mutate()}>Add {matched.length} item{matched.length === 1 ? "" : "s"}</Button></div>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); parse.mutate(); }} className="space-y-3">
      <Field label="What did you eat?" hint="For example: 2 eggs, a banana, and 150 g chicken breast."><textarea className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-base focus-visible:outline-2 focus-visible:outline-foreground" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} /></Field>
      <ErrorNote error={parse.error} />
      <Button type="submit" className="w-full" loading={parse.isPending} disabled={text.trim().length < 2}><Sparkles size={18} />Find foods</Button>
    </form>
  );
}

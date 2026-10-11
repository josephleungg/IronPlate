"use client";
import clsx, { type ClassValue } from "clsx";
import { useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { X } from "lucide-react";

export const cx = (...v: ClassValue[]) => clsx(v);

type Tone = "default" | "hero" | "lavender" | "lime";
const cardTone: Record<Tone, string> = {
  default: "bg-card border-border",
  hero: "bg-hero text-hero-fg border-transparent",
  lavender: "bg-lavender text-lavender-fg border-transparent",
  lime: "bg-lime text-[#14213d] border-transparent",
};
export function Card({ tone = "default", className, ...p }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cx("rounded-card border p-4 min-w-0", cardTone[tone], className)} {...p} />;
}

/** Secondary text that adapts to the surface it's on. */
export const Muted = ({ className, ...p }: HTMLAttributes<HTMLSpanElement>) => <span className={cx("text-sm text-current opacity-70", className)} {...p} />;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "lime" | "secondary" | "ghost" | "danger"; size?: "md" | "sm"; loading?: boolean };
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-primary text-primary-fg",
    lime: "bg-lime text-[#14213d]",
    secondary: "border border-border bg-card text-foreground",
    ghost: "text-foreground hover:bg-track",
    danger: "border border-border bg-card text-[#b3261e] dark:text-[#ff8a80]",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-button font-medium transition-[transform,opacity] active:scale-[.98] disabled:opacity-50 disabled:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        size === "md" ? "min-h-11 px-5 text-base" : "min-h-9 px-4 text-sm",
        v, className,
      )}
      disabled={disabled || loading}
      {...p}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={cx("inline-flex size-11 items-center justify-center rounded-button text-foreground hover:bg-track focus-visible:outline-2 focus-visible:outline-foreground", className)} {...p} />;
}

export function Pill({ tone = "line", className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: "line" | "lime" | "lavender" }) {
  const t = { line: "border border-border text-muted", lime: "bg-lime text-[#14213d]", lavender: "bg-lavender text-lavender-fg" }[tone];
  return <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium", t, className)} {...p} />;
}

export function Stat({ label, value, unit, tone = "default", className }: { label: string; value: ReactNode; unit?: string; tone?: Tone; className?: string }) {
  return (
    <Card tone={tone} className={cx("px-3 py-3.5", className)}>
      <div className={cx("text-sm", tone === "lime" ? "" : "text-muted", tone === "hero" && "!text-hero-muted")}>{label}</div>
      <div className="display mt-0.5 text-[26px] leading-tight">{value}{unit ? <span className="ml-1 text-sm font-medium opacity-70">{unit}</span> : null}</div>
    </Card>
  );
}

export const inputCls = "h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground";
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx(inputCls, className)} {...p} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx(inputCls, "pr-8", className)} {...p} />;
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex rounded-lg bg-track p-1", className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cx("min-h-9 flex-1 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-foreground", o.value === value ? "bg-primary text-primary-fg" : "text-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("animate-pulse rounded-lg bg-track", className)} />;

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <div className="font-display text-lg font-bold">{title}</div>
      {body ? <p className="max-w-xs text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="rounded-lg bg-[#fde8e6] px-3 py-2 text-sm text-[#8a1c14] dark:bg-[#3a1a18] dark:text-[#ffb4ab]">{error instanceof Error ? error.message : "Something went wrong."}</p>;
}

/** Bottom sheet built on <dialog>, so focus handling and Escape come from the browser. */
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Elements mount before the dialog is shown, so React's autoFocus can't work here.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cx("m-0 mx-auto mt-auto w-full max-w-lg overflow-hidden rounded-t-[16px] border border-border bg-background p-0 text-foreground backdrop:bg-black/50", tall ? "h-[88dvh]" : "max-h-[88dvh]")}
    >
      {open ? (
        <div className="flex max-h-[inherit] flex-col" style={{ height: tall ? "88dvh" : undefined }}>
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h2 className="text-xl">{title}</h2>
            <IconButton label="Close" onClick={onClose}><X size={22} /></IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Circular progress. `value` is 0..1. */
export function Ring({ value, size = 104, stroke = 10, children, track = "rgba(247,248,242,.16)" }: { value: number; size?: number; stroke?: number; children?: ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${Math.round(v * 100)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d6f85a" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ transition: "stroke-dasharray .4s cubic-bezier(.22,1,.36,1)" }} /> : null}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return <div className="flex shrink-0 items-center justify-center rounded-full bg-lavender font-display font-bold text-lavender-fg" style={{ width: size, height: size, fontSize: size * 0.35 }} aria-hidden>{ini}</div>;
}

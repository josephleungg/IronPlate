"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/hooks";
import { Avatar } from "./ui";

/** Screen title with an optional subtitle and the user's avatar (links to their profile). */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  const me = useMe();
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[32px] leading-tight">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
      </div>
      <div className="flex items-center gap-1">
        {right}
        {me.data?.username ? <Link href={`/u/${me.data.username}`} aria-label="Your profile"><Avatar name={me.data.profile.displayName} size={44} /></Link> : null}
      </div>
    </header>
  );
}

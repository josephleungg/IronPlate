"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, ChartLine, Dumbbell, Users } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { cx } from "./ui";

const TABS = [
  { href: "/diary", label: "Diary", icon: BookOpenText },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/progress", label: "Progress", icon: ChartLine },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const me = useMe();
  const unread = useQuery({ queryKey: ["unread"], queryFn: () => api<{ count: number }>("/notifications/unread-count"), refetchInterval: 30_000 });

  useEffect(() => {
    if (me.data && !me.data.onboarded) router.replace("/onboarding");
  }, [me.data, router]);

  // The live workout takes over the whole screen, without the tab bar.
  const immersive = path.startsWith("/train/workout");

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <div className={cx("px-4 pt-6", immersive ? "pb-6" : "pb-28")}>{children}</div>
      {immersive ? null : (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
          <ul className="mx-auto flex max-w-lg px-1.5 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
            {TABS.map((t) => {
              const active = path === t.href || path.startsWith(`${t.href}/`);
              const Icon = t.icon;
              return (
                <li key={t.href} className="flex-1">
                  <Link href={t.href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-0.5 text-xs font-medium text-muted aria-[current=page]:text-foreground">
                    <span className={cx("relative flex h-8 w-14 items-center justify-center rounded-lg transition-colors", active && "bg-lime text-[#14213d]")}>
                      <Icon size={22} strokeWidth={2} />
                      {t.href === "/friends" && (unread.data?.count ?? 0) > 0 ? <span className="absolute right-2 top-1 size-2 rounded-full bg-[#e5484d]" aria-label={`${unread.data!.count} unread`} /> : null}
                    </span>
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

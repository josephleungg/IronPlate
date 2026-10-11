"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Avatar, Card, Empty, ErrorNote, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Notification, Page } from "@/lib/types";

function text(n: Notification) {
  const who = n.actor?.displayName ?? "Someone";
  switch (n.type) {
    case "like": return `${who} liked your post`;
    case "comment": return `${who} commented${n.data?.preview ? `: "${String(n.data.preview)}"` : ""}`;
    case "follow": return `${who} started following you`;
    case "follow_request": return `${who} wants to follow you`;
    case "follow_accepted": return `${who} accepted your follow request`;
    case "pr": return "You set a new personal record";
    default: return "New activity";
  }
}

export function NotificationsView() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api<Page<Notification>>("/notifications?limit=50") });

  // Opening the inbox marks everything read (after we've captured which were unread, for styling).
  useEffect(() => {
    if (q.data?.data.some((n) => !n.readAt)) {
      const t = setTimeout(() => api("/notifications/read", { method: "POST", body: { all: true } }).then(() => qc.invalidateQueries({ queryKey: ["unread"] })).catch(() => {}), 1500);
      return () => clearTimeout(t);
    }
  }, [q.data, qc]);

  return (
    <div className="space-y-4">
      <Link href="/friends" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted"><ArrowLeft size={18} />Friends</Link>
      <h1 className="text-[32px] leading-tight">Notifications</h1>
      {q.isLoading ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : q.error ? <ErrorNote error={q.error} /> : q.data?.data.length ? (
        <ul className="space-y-2">{q.data.data.map((n) => {
          const inner = (
            <Card className={cx("flex items-center gap-3 py-3", !n.readAt && "border-foreground/30")}>
              <Avatar name={n.actor?.displayName ?? "?"} size={40} />
              <div className="min-w-0 flex-1"><div className="break-words">{text(n)}</div><div className="text-sm text-muted">{timeAgo(n.createdAt)}</div></div>
              {!n.readAt ? <span className="size-2.5 shrink-0 rounded-full bg-lime" aria-label="Unread" /> : null}
            </Card>
          );
          const href = n.postId ? `/p/${n.postId}` : n.actor?.username ? `/u/${n.actor.username}` : null;
          return <li key={n.id}>{href ? <Link href={href} className="block rounded-card focus-visible:outline-2 focus-visible:outline-foreground">{inner}</Link> : inner}</li>;
        })}</ul>
      ) : <Empty title="All caught up" body="Likes, comments and new followers will show up here." />}
    </div>
  );
}

"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PostCard } from "@/components/post-card";
import { Avatar, Button, Card, Empty, ErrorNote, Input, Segmented, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { Author, Page, Post } from "@/lib/types";

type Tab = "following" | "discover" | "people";
type Person = Author & { followStatus: "accepted" | "pending" | null; isPrivate: boolean };

function Feed({ kind }: { kind: "feed" | "feed/discover" }) {
  const q = useInfiniteQuery({
    queryKey: ["feed", kind],
    queryFn: ({ pageParam }) => api<Page<Post>>(`/${kind}?limit=10${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const posts = q.data?.pages.flatMap((p) => p.data) ?? [];
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  if (q.error) return <ErrorNote error={q.error} />;
  if (!posts.length) {
    return kind === "feed"
      ? <Empty icon={<UserPlus size={28} />} title="Your feed is quiet" body="Follow friends to see their workouts here. Your own shared workouts show up too." />
      : <Empty title="Nothing to discover yet" body="Public workouts from people with open accounts will appear here." />;
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
      {q.hasNextPage ? <Button variant="secondary" className="w-full" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Show more</Button> : null}
    </div>
  );
}

function People() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const res = useQuery({ queryKey: ["people", dq], queryFn: () => api<{ data: Person[] }>(`/search/users?q=${encodeURIComponent(dq)}`), enabled: dq.length >= 2 });
  const follow = useMutation({
    mutationFn: (p: Person) => api<{ status: "accepted" | "pending" }>(`/users/${p.username}/follow`, { method: p.followStatus ? "DELETE" : "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); qc.invalidateQueries({ queryKey: ["feed"] }); },
  });
  return (
    <div className="space-y-3">
      <div className="relative"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input aria-label="Search people" placeholder="Search by name or username" value={text} onChange={(e) => setText(e.target.value)} className="pl-10" /></div>
      <ErrorNote error={follow.error} />
      {dq.length < 2 ? <Empty icon={<Search />} title="Find your friends" body="Search by their username or name." /> : res.isLoading ? <Skeleton className="h-16" /> : res.data?.data.length ? (
        <ul className="space-y-2">{res.data.data.map((p) => (
          <li key={p.id}>
            <Card className="flex items-center gap-3 py-3">
              <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={p.displayName} /><span className="min-w-0"><span className="block truncate font-medium">{p.displayName}</span><span className="block truncate text-sm text-muted">@{p.username}</span></span></Link>
              <Button size="sm" variant={p.followStatus ? "secondary" : "primary"} loading={follow.isPending && follow.variables?.id === p.id} onClick={() => follow.mutate(p)}>{p.followStatus === "accepted" ? "Following" : p.followStatus === "pending" ? "Requested" : "Follow"}</Button>
            </Card>
          </li>
        ))}</ul>
      ) : <Empty title="No one found" body="Check the spelling, or ask your friend for their exact username." />}
    </div>
  );
}

function Requests() {
  const qc = useQueryClient();
  const r = useQuery({ queryKey: ["follow-requests"], queryFn: () => api<(Author & { requestedAt: string })[]>("/me/follow-requests") });
  const answer = useMutation({
    mutationFn: (v: { id: string; ok: boolean }) => api(`/me/follow-requests/${v.id}/${v.ok ? "accept" : "decline"}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["follow-requests"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
  });
  if (!r.data?.length) return null;
  return (
    <Card tone="lavender" className="space-y-2">
      <div className="font-medium">Follow requests</div>
      {r.data.map((p) => (
        <div key={p.id} className="flex items-center gap-3">
          <Avatar name={p.displayName} size={36} /><span className="min-w-0 flex-1 truncate">{p.displayName}</span>
          <Button size="sm" onClick={() => answer.mutate({ id: p.id, ok: true })}>Accept</Button>
          <Button size="sm" variant="ghost" onClick={() => answer.mutate({ id: p.id, ok: false })}>Decline</Button>
        </div>
      ))}
    </Card>
  );
}

export function FriendsView() {
  const [tab, setTab] = useState<Tab>("following");
  const unread = useQuery({ queryKey: ["unread"], queryFn: () => api<{ count: number }>("/notifications/unread-count"), refetchInterval: 30_000 });
  return (
    <>
      <PageHeader title="Friends" right={
        <Link href="/notifications" aria-label={`Notifications${unread.data?.count ? `, ${unread.data.count} unread` : ""}`} className="relative inline-flex size-11 items-center justify-center rounded-button hover:bg-track">
          <Bell size={22} />{unread.data?.count ? <span className="absolute right-2 top-2 flex min-w-4 items-center justify-center rounded-full bg-[#e5484d] px-1 text-[10px] font-bold leading-4 text-white">{unread.data.count > 9 ? "9+" : unread.data.count}</span> : null}
        </Link>
      } />
      <div className="space-y-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "following", label: "Following" }, { value: "discover", label: "Discover" }, { value: "people", label: "Find people" }]} />
        <Requests />
        {tab === "following" ? <Feed kind="feed" /> : tab === "discover" ? <Feed kind="feed/discover" /> : <People />}
      </div>
    </>
  );
}

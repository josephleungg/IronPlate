"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Settings } from "lucide-react";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { Avatar, Button, Card, Empty, ErrorNote, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Page, Post, ProfileView as Profile } from "@/lib/types";

export function ProfileView({ username }: { username: string }) {
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ["profile", username], queryFn: () => api<Profile>(`/users/${username}`), retry: false });
  const posts = useInfiniteQuery({
    queryKey: ["feed", "user", username],
    queryFn: ({ pageParam }) => api<Page<Post>>(`/users/${username}/posts?limit=10${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (x) => x.nextCursor ?? undefined,
    enabled: Boolean(p.data?.canViewContent),
  });
  const follow = useMutation({
    mutationFn: () => api(`/users/${username}/follow`, { method: p.data?.relationship.following || p.data?.relationship.requested ? "DELETE" : "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile", username] }); qc.invalidateQueries({ queryKey: ["feed"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
  });

  if (p.isLoading) return <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-24" /></div>;
  if (p.error instanceof ApiError && p.error.status === 404) return <Empty title="Profile not found" body="Check the username, or you may not be able to see this person." action={<Link href="/friends"><Button variant="secondary">Back to Friends</Button></Link>} />;
  if (!p.data) return <ErrorNote error={p.error} />;
  const d = p.data;
  const rel = d.relationship;
  const list = posts.data?.pages.flatMap((x) => x.data) ?? [];

  return (
    <div className="space-y-4">
      <Link href="/friends" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted"><ArrowLeft size={18} />Back</Link>
      <Card tone="hero" className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={d.displayName} size={64} />
          <div className="min-w-0"><h1 className="truncate text-[28px] leading-tight">{d.displayName}</h1><div className="text-hero-muted">@{d.username}</div></div>
        </div>
        {d.bio ? <p>{d.bio}</p> : null}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Workouts", d.workouts], ["Followers", d.followers], ["Following", d.following]].map(([l, v]) => <div key={l as string}><div className="display text-2xl">{v}</div><div className="text-sm text-hero-muted">{l}</div></div>)}
        </div>
        {rel.isSelf ? <Link href="/settings" className="block"><Button variant="lime" className="w-full"><Settings size={18} />Settings and profile</Button></Link>
          : <Button variant={rel.following || rel.requested ? "secondary" : "lime"} className="w-full" loading={follow.isPending} onClick={() => follow.mutate()}>{rel.following ? "Following" : rel.requested ? "Requested" : "Follow"}</Button>}
      </Card>
      <ErrorNote error={follow.error} />
      {!d.canViewContent ? <Empty icon={<Lock size={28} />} title="This account is private" body={rel.requested ? "Your request is pending." : "Follow to see their workouts."} /> : posts.isLoading ? <Skeleton className="h-48" /> : list.length ? (
        <div className="space-y-3">{list.map((x) => <PostCard key={x.id} post={x} />)}{posts.hasNextPage ? <Button variant="secondary" className="w-full" loading={posts.isFetchingNextPage} onClick={() => posts.fetchNextPage()}>Show more</Button> : null}</div>
      ) : <Empty title="No posts yet" body={rel.isSelf ? "Finish a workout and share it to see it here." : "Nothing shared yet."} />}
    </div>
  );
}

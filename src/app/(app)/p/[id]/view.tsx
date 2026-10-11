"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PostCard } from "@/components/post-card";
import { Avatar, Button, Empty, ErrorNote, IconButton, Input, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useMe } from "@/lib/hooks";
import type { Comment, Post } from "@/lib/types";

export function PostView({ id }: { id: string }) {
  const qc = useQueryClient();
  const me = useMe();
  const [text, setText] = useState("");
  const post = useQuery({ queryKey: ["post", id], queryFn: () => api<Post>(`/posts/${id}`), retry: false });
  const comments = useQuery({ queryKey: ["comments", id], queryFn: () => api<{ data: Comment[] }>(`/posts/${id}/comments`), enabled: post.isSuccess });
  const add = useMutation({
    mutationFn: () => api(`/posts/${id}/comments`, { method: "POST", body: { body: text.trim() } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["comments", id] }); qc.invalidateQueries({ queryKey: ["post", id] }); qc.invalidateQueries({ queryKey: ["feed"] }); },
  });
  const del = useMutation({
    mutationFn: (cid: string) => api(`/comments/${cid}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comments", id] }); qc.invalidateQueries({ queryKey: ["post", id] }); },
  });

  if (post.isLoading) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-48" /></div>;
  if (post.error instanceof ApiError && post.error.status === 404) return <Empty title="Post not found" body="It may have been removed, or it isn't shared with you." action={<Link href="/friends"><Button variant="secondary">Back to Friends</Button></Link>} />;
  if (!post.data) return <ErrorNote error={post.error} />;

  return (
    <div className="space-y-4">
      <Link href="/friends" className="-ml-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted"><ArrowLeft size={18} />Back</Link>
      <PostCard key={post.data.likeCount} post={post.data} detail />
      <section aria-labelledby="comments-h" className="space-y-3">
        <h2 id="comments-h" className="text-[22px]">Comments</h2>
        {comments.isLoading ? <Skeleton className="h-16" /> : comments.data?.data.length ? (
          <ul className="space-y-3">{comments.data.data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.displayName} size={36} />
              <div className="min-w-0 flex-1"><div className="text-sm"><span className="font-medium">{c.author.displayName}</span> <span className="text-muted">· {timeAgo(c.createdAt)}</span></div><p className="whitespace-pre-wrap break-words">{c.body}</p></div>
              {c.author.id === me.data?.id || post.data!.author.id === me.data?.id ? <IconButton label="Delete comment" className="size-9" onClick={() => del.mutate(c.id)}><Trash2 size={16} className="text-muted" /></IconButton> : null}
            </li>
          ))}</ul>
        ) : <p className="text-sm text-muted">No comments yet. Say something encouraging.</p>}
        <ErrorNote error={add.error ?? del.error} />
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(); }} className="flex gap-2">
          <Input aria-label="Add a comment" placeholder="Add a comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <Button type="submit" className="px-4" aria-label="Send comment" loading={add.isPending} disabled={!text.trim()}><Send size={18} /></Button>
        </form>
      </section>
    </div>
  );
}

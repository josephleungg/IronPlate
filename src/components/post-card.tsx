"use client";
import { Heart, MessageCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { fmtVolume, shortDuration, timeAgo } from "@/lib/format";
import { useUnits } from "@/lib/hooks";
import type { Post } from "@/lib/types";
import { Avatar, Card, Pill, cx } from "./ui";

export function PostCard({ post, detail = false }: { post: Post; detail?: boolean }) {
  const u = useUnits();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likeCount);
  const [busy, setBusy] = useState(false);
  const w = post.workout;

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await api(`/posts/${post.id}/like`, { method: next ? "POST" : "DELETE" });
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <>
      {w ? (
        <>
          <h2 className="text-[22px] leading-tight">{w.title}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="min-w-0"><div className="display text-[28px] leading-tight">{shortDuration(w.durationS)}</div><div className="text-sm text-muted">Time</div></div>
            <div className="min-w-0"><div className="display text-[28px] leading-tight">{fmtVolume(w.totalVolumeKg, u.lift)}</div><div className="text-sm text-muted">{u.lift} volume</div></div>
            <div className="min-w-0"><div className="display text-[28px] leading-tight">{w.prCount}</div><div className="text-sm text-muted">PR{w.prCount === 1 ? "" : "s"}</div></div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{w.exercises.map((e) => `${e.sets} × ${e.name}`).join(" · ")}</p>
          {w.prCount ? <Pill tone="lime" className="mt-3"><Trophy size={14} />{w.prCount} new personal record{w.prCount === 1 ? "" : "s"}</Pill> : null}
        </>
      ) : null}
      {post.body ? <p className={cx("whitespace-pre-wrap", w && "mt-3")}>{post.body}</p> : null}
    </>
  );

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <Link href={post.author.username ? `/u/${post.author.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-foreground">
          <Avatar name={post.author.displayName} />
          <span className="min-w-0"><span className="block truncate font-medium">{post.author.displayName}</span><span className="block text-sm text-muted">{timeAgo(post.createdAt)}</span></span>
        </Link>
      </div>
      {w && !detail ? <Link href={`/train/w/${w.id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">{body}</Link> : <div>{body}</div>}
      <div className="flex items-center gap-5 pt-1">
        <button type="button" onClick={toggle} aria-pressed={liked} aria-label={`${liked ? "Unlike" : "Like"}. ${likes} like${likes === 1 ? "" : "s"}`} className={cx("flex min-h-11 items-center gap-1.5 text-sm", liked ? "text-[#e5484d]" : "text-muted")}>
          <Heart size={22} fill={liked ? "currentColor" : "none"} />{likes}
        </button>
        {detail ? <span className="flex items-center gap-1.5 text-sm text-muted"><MessageCircle size={22} />{post.commentCount}</span> : (
          <Link href={`/p/${post.id}`} aria-label={`${post.commentCount} comments`} className="flex min-h-11 items-center gap-1.5 text-sm text-muted"><MessageCircle size={22} />{post.commentCount}</Link>
        )}
      </div>
    </Card>
  );
}

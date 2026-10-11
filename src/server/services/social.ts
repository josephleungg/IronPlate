import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/driver";
import {
  blocks, comments, exercises, follows, likes, mediaAssets, notifications, postMedia, posts, profiles, user, workoutExercises, workouts,
} from "@/db/schema";
import { uuidv7 } from "@/lib/id";
import { badRequest, conflict, decodeCursor, encodeCursor, forbidden, notFound } from "../http";
import { canView, followedAuthorsClause, relationship } from "../permissions";

// ------------------------------------------------------------ people & follows

const publicUser = { id: user.id, username: user.username, displayName: profiles.displayName, avatarMediaId: profiles.avatarMediaId, isPrivate: profiles.isPrivate };

export async function notify(n: { userId: string; actorId: string; type: (typeof notifications.$inferInsert)["type"]; postId?: string; data?: Record<string, unknown> }) {
  if (n.userId === n.actorId) return;
  await db.insert(notifications).values({ userId: n.userId, actorId: n.actorId, type: n.type, postId: n.postId ?? null, data: n.data ?? null });
}

export async function getProfile(viewerId: string, username: string) {
  const [u] = await db
    .select({ ...publicUser, bio: profiles.bio, followers: profiles.followersCount, following: profiles.followingCount, workouts: profiles.workoutsCount, joinedAt: user.createdAt })
    .from(user).innerJoin(profiles, eq(profiles.userId, user.id)).where(eq(user.username, username.toLowerCase()));
  if (!u) throw notFound("User");
  const rel = await relationship(viewerId, u.id);
  if (rel.blocked) throw notFound("User");
  return {
    ...u,
    relationship: { isSelf: rel.isSelf, following: rel.following, requested: rel.requested },
    // Private accounts show only the basics until you follow them.
    canViewContent: canView(rel, "followers") || (!u.isPrivate && canView(rel, "public")),
  };
}

export async function searchUsers(viewerId: string, q: string) {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const pat = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select({ ...publicUser, followStatus: sql<string | null>`(select status from follows where follower_id = ${viewerId} and followee_id = ${user.id})` })
    .from(user).innerJoin(profiles, eq(profiles.userId, user.id))
    .where(and(
      sql`${user.id} != ${viewerId}`,
      or(sql`${user.username} like ${pat} escape '\\'`, sql`lower(${profiles.displayName}) like ${pat} escape '\\'`),
      sql`not exists (select 1 from blocks where (blocker_id = ${viewerId} and blocked_id = ${user.id}) or (blocker_id = ${user.id} and blocked_id = ${viewerId}))`,
    ))
    .limit(20);
  return rows;
}

async function recountFollows(userIds: string[]) {
  await db.run(sql`update profiles set
    followers_count = (select count(*) from follows where followee_id = profiles.user_id and status = 'accepted'),
    following_count = (select count(*) from follows where follower_id = profiles.user_id and status = 'accepted')
    where user_id in (${sql.join(userIds.map((i) => sql`${i}`), sql`, `)})`);
}

export async function follow(viewerId: string, targetId: string) {
  if (viewerId === targetId) throw badRequest("You can't follow yourself");
  const rel = await relationship(viewerId, targetId);
  const [target] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, targetId));
  if (!target || rel.blocked) throw notFound("User");
  if (rel.following || rel.requested) return { status: rel.following ? "accepted" : "pending" } as const;
  const status = rel.isPrivateAccount ? "pending" : "accepted";
  await db.insert(follows).values({ followerId: viewerId, followeeId: targetId, status, acceptedAt: status === "accepted" ? new Date() : null }).onConflictDoNothing();
  if (status === "accepted") await recountFollows([viewerId, targetId]);
  await notify({ userId: targetId, actorId: viewerId, type: status === "accepted" ? "follow" : "follow_request" });
  return { status } as const;
}

export async function unfollow(viewerId: string, targetId: string) {
  await db.delete(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, targetId)));
  await recountFollows([viewerId, targetId]);
}

export async function removeFollower(viewerId: string, followerId: string) {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, viewerId)));
  await recountFollows([viewerId, followerId]);
}

export async function listFollowRequests(viewerId: string) {
  return db.select({ ...publicUser, requestedAt: follows.createdAt }).from(follows).innerJoin(user, eq(user.id, follows.followerId)).innerJoin(profiles, eq(profiles.userId, user.id))
    .where(and(eq(follows.followeeId, viewerId), eq(follows.status, "pending"))).orderBy(desc(follows.createdAt));
}

export async function answerFollowRequest(viewerId: string, followerId: string, accept: boolean) {
  const [req] = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, viewerId), eq(follows.status, "pending")));
  if (!req) throw notFound("Follow request");
  if (accept) {
    await db.update(follows).set({ status: "accepted", acceptedAt: new Date() }).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, viewerId)));
    await recountFollows([viewerId, followerId]);
    await notify({ userId: followerId, actorId: viewerId, type: "follow_accepted" });
  } else {
    await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, viewerId)));
  }
}

export async function listFollowing(viewerId: string, ofUserId: string, direction: "followers" | "following") {
  const rel = await relationship(viewerId, ofUserId);
  if (rel.blocked || !canView(rel, "followers")) throw forbidden("Follow this person to see who they follow");
  const [self, other] = direction === "followers" ? [follows.followeeId, follows.followerId] : [follows.followerId, follows.followeeId];
  return db.select(publicUser).from(follows).innerJoin(user, eq(user.id, other)).innerJoin(profiles, eq(profiles.userId, user.id))
    .where(and(eq(self, ofUserId), eq(follows.status, "accepted"))).orderBy(desc(follows.createdAt)).limit(100);
}

export async function block(viewerId: string, targetId: string) {
  if (viewerId === targetId) throw badRequest("You can't block yourself");
  await db.batch([
    db.insert(blocks).values({ blockerId: viewerId, blockedId: targetId }).onConflictDoNothing(),
    db.delete(follows).where(or(and(eq(follows.followerId, viewerId), eq(follows.followeeId, targetId)), and(eq(follows.followerId, targetId), eq(follows.followeeId, viewerId)))),
  ]);
  await recountFollows([viewerId, targetId]);
}
export const unblock = (viewerId: string, targetId: string) => db.delete(blocks).where(and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, targetId)));
export const listBlocks = (viewerId: string) =>
  db.select(publicUser).from(blocks).innerJoin(user, eq(user.id, blocks.blockedId)).innerJoin(profiles, eq(profiles.userId, user.id)).where(eq(blocks.blockerId, viewerId));

// ------------------------------------------------------------ posts & feed

export const postInput = z.object({
  type: z.enum(["text", "meal", "day", "progress"]).default("text"),
  body: z.string().trim().max(500).optional(),
  diaryDate: z.string().optional(),
  visibility: z.enum(["followers", "public"]).default("followers"),
  mediaIds: z.array(z.string()).max(10).default([]),
}).refine((p) => p.body || p.mediaIds.length, "A post needs some text or a photo");

async function hydratePosts(viewerId: string, rows: { post: typeof posts.$inferSelect; author: { id: string; username: string | null; displayName: string; avatarMediaId: string | null } }[]) {
  if (!rows.length) return [];
  const postIds = rows.map((r) => r.post.id);
  const workoutIds = rows.map((r) => r.post.workoutId).filter((x): x is string => Boolean(x));
  const [workoutRows, exRows, liked, media] = await Promise.all([
    workoutIds.length ? db.select().from(workouts).where(and(inArray(workouts.id, workoutIds), isNull(workouts.deletedAt))) : Promise.resolve([]),
    workoutIds.length
      ? db.select({ workoutId: workoutExercises.workoutId, name: exercises.name, sets: sql<number>`(select count(*) from workout_sets s where s.workout_exercise_id = ${workoutExercises.id} and s.set_type != 'warmup')` })
          .from(workoutExercises).innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId)).where(inArray(workoutExercises.workoutId, workoutIds)).orderBy(workoutExercises.position)
      : Promise.resolve([]),
    db.select({ postId: likes.postId }).from(likes).where(and(eq(likes.userId, viewerId), inArray(likes.postId, postIds))),
    db.select({ postId: postMedia.postId, mediaId: postMedia.mediaId, position: postMedia.position }).from(postMedia).where(inArray(postMedia.postId, postIds)).orderBy(postMedia.position),
  ]);
  const likedSet = new Set(liked.map((l) => l.postId));
  return rows.map(({ post, author }) => {
    const w = workoutRows.find((x) => x.id === post.workoutId);
    return {
      id: post.id, type: post.type, body: post.body, visibility: post.visibility, createdAt: post.createdAt,
      likeCount: post.likeCount, commentCount: post.commentCount, likedByMe: likedSet.has(post.id), author,
      media: media.filter((m) => m.postId === post.id).map((m) => ({ id: m.mediaId, url: `/api/v1/media/${m.mediaId}/content` })),
      workout: w ? {
        id: w.id, title: w.title, description: w.description, startedAt: w.startedAt, durationS: w.durationS, totalVolumeKg: w.totalVolumeKg,
        totalSets: w.totalSets, prCount: w.prCount, exercises: exRows.filter((e) => e.workoutId === w.id).map((e) => ({ name: e.name, sets: e.sets })),
      } : null,
    };
  });
}

type Page = { limit: number; cursor?: string };

async function postsPage(viewerId: string, where: ReturnType<typeof and>, { limit, cursor }: Page) {
  const c = decodeCursor<{ t: number; id: string }>(cursor);
  const rows = await db
    .select({ post: posts, author: { id: user.id, username: user.username, displayName: profiles.displayName, avatarMediaId: profiles.avatarMediaId } })
    .from(posts).innerJoin(user, eq(user.id, posts.userId)).innerJoin(profiles, eq(profiles.userId, user.id))
    .where(and(isNull(posts.deletedAt), where, c ? or(lt(posts.createdAt, new Date(c.t)), and(eq(posts.createdAt, new Date(c.t)), lt(posts.id, c.id))) : undefined))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { data: await hydratePosts(viewerId, page), nextCursor: rows.length > limit && last ? encodeCursor({ t: last.post.createdAt.getTime(), id: last.post.id }) : null };
}

export const homeFeed = (viewerId: string, page: Page) => postsPage(viewerId, followedAuthorsClause(viewerId, posts.userId) as any, page);

export const discoverFeed = (viewerId: string, page: Page) =>
  postsPage(viewerId, and(
    eq(posts.visibility, "public"),
    sql`${posts.userId} != ${viewerId}`,
    sql`${posts.userId} in (select user_id from profiles where is_private = 0)`,
    sql`not exists (select 1 from blocks where (blocker_id = ${viewerId} and blocked_id = ${posts.userId}) or (blocker_id = ${posts.userId} and blocked_id = ${viewerId}))`,
  ), page);

export async function userPosts(viewerId: string, ownerId: string, page: Page) {
  const rel = await relationship(viewerId, ownerId);
  if (rel.blocked) throw notFound("User");
  const seesFollowers = canView(rel, "followers");
  if (!seesFollowers && !canView(rel, "public")) return { data: [], nextCursor: null };
  return postsPage(viewerId, and(eq(posts.userId, ownerId), seesFollowers ? undefined : eq(posts.visibility, "public")), page);
}

async function getVisiblePost(viewerId: string, postId: string) {
  const [p] = await db.select().from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!p) throw notFound("Post");
  const rel = await relationship(viewerId, p.userId);
  if (!canView(rel, p.visibility === "public" ? "public" : "followers")) throw notFound("Post");
  return p;
}

export async function getPost(viewerId: string, postId: string) {
  const p = await getVisiblePost(viewerId, postId);
  const [author] = await db.select({ id: user.id, username: user.username, displayName: profiles.displayName, avatarMediaId: profiles.avatarMediaId }).from(user).innerJoin(profiles, eq(profiles.userId, user.id)).where(eq(user.id, p.userId));
  return (await hydratePosts(viewerId, [{ post: p, author }]))[0];
}

export async function createPost(viewerId: string, i: z.infer<typeof postInput>) {
  let mediaIds: string[] = [];
  if (i.mediaIds.length) {
    mediaIds = (await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, i.mediaIds), eq(mediaAssets.ownerId, viewerId), eq(mediaAssets.status, "ready")))).map((m) => m.id);
  }
  const id = uuidv7();
  await db.batch([
    db.insert(posts).values({ id, userId: viewerId, type: i.type, body: i.body ?? null, diaryDate: i.diaryDate ?? null, visibility: i.visibility }),
    ...(mediaIds.length ? [db.insert(postMedia).values(mediaIds.map((mediaId, position) => ({ postId: id, mediaId, position })))] : []),
  ] as [any, ...any[]]);
  return getPost(viewerId, id);
}

export async function deletePost(viewerId: string, postId: string) {
  const [p] = await db.select().from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!p) throw notFound("Post");
  if (p.userId !== viewerId) throw forbidden();
  if (p.workoutId) throw conflict("Delete the workout, or set it to private, to remove its post");
  await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId));
}

export async function likePost(viewerId: string, postId: string) {
  const p = await getVisiblePost(viewerId, postId);
  const res = await db.insert(likes).values({ userId: viewerId, postId }).onConflictDoNothing().returning({ postId: likes.postId });
  if (res.length) {
    await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1` }).where(eq(posts.id, postId));
    await notify({ userId: p.userId, actorId: viewerId, type: "like", postId });
  }
}

export async function unlikePost(viewerId: string, postId: string) {
  const res = await db.delete(likes).where(and(eq(likes.userId, viewerId), eq(likes.postId, postId))).returning({ postId: likes.postId });
  if (res.length) await db.update(posts).set({ likeCount: sql`max(${posts.likeCount} - 1, 0)` }).where(eq(posts.id, postId));
}

export const commentInput = z.object({ body: z.string().trim().min(1).max(500), parentId: z.string().optional() });

export async function listComments(viewerId: string, postId: string) {
  await getVisiblePost(viewerId, postId);
  return db
    .select({ id: comments.id, parentId: comments.parentId, body: comments.body, createdAt: comments.createdAt, author: { id: user.id, username: user.username, displayName: profiles.displayName } })
    .from(comments).innerJoin(user, eq(user.id, comments.userId)).innerJoin(profiles, eq(profiles.userId, user.id))
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt))).orderBy(comments.createdAt).limit(300);
}

export async function addComment(viewerId: string, postId: string, i: z.infer<typeof commentInput>) {
  const p = await getVisiblePost(viewerId, postId);
  if (i.parentId) {
    const [parent] = await db.select({ id: comments.id }).from(comments).where(and(eq(comments.id, i.parentId), eq(comments.postId, postId), isNull(comments.deletedAt)));
    if (!parent) throw badRequest("The comment you're replying to is gone", "UNKNOWN_PARENT");
  }
  const id = uuidv7();
  await db.batch([
    db.insert(comments).values({ id, postId, userId: viewerId, parentId: i.parentId ?? null, body: i.body }),
    db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, postId)),
  ]);
  await notify({ userId: p.userId, actorId: viewerId, type: "comment", postId, data: { commentId: id, preview: i.body.slice(0, 80) } });
  return { id };
}

export async function deleteComment(viewerId: string, commentId: string) {
  const [c] = await db.select({ c: comments, owner: posts.userId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  if (!c) throw notFound("Comment");
  if (c.c.userId !== viewerId && c.owner !== viewerId) throw forbidden();
  await db.batch([
    db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId)),
    db.update(posts).set({ commentCount: sql`max(${posts.commentCount} - 1, 0)` }).where(eq(posts.id, c.c.postId)),
  ]);
}

// ------------------------------------------------------------ notifications

export async function listNotifications(viewerId: string, { limit, cursor }: Page) {
  const c = decodeCursor<{ t: number; id: string }>(cursor);
  const rows = await db
    .select({ n: notifications, actor: { id: user.id, username: user.username, displayName: profiles.displayName } })
    .from(notifications).leftJoin(user, eq(user.id, notifications.actorId)).leftJoin(profiles, eq(profiles.userId, notifications.actorId))
    .where(and(eq(notifications.userId, viewerId), c ? or(lt(notifications.createdAt, new Date(c.t)), and(eq(notifications.createdAt, new Date(c.t)), lt(notifications.id, c.id))) : undefined))
    .orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { data: page.map((r) => ({ ...r.n, actor: r.actor?.id ? r.actor : null })), nextCursor: rows.length > limit && last ? encodeCursor({ t: last.n.createdAt.getTime(), id: last.n.id }) : null };
}

export async function unreadCount(viewerId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, viewerId), isNull(notifications.readAt)));
  return { count: r?.n ?? 0 };
}

export async function markRead(viewerId: string, input: { ids?: string[]; all?: boolean }) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, viewerId), isNull(notifications.readAt), input.all ? undefined : inArray(notifications.id, input.ids?.length ? input.ids : ["-"])));
}


export async function userIdByUsername(username: string): Promise<string> {
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.username, username.toLowerCase()));
  if (!u) throw notFound("User");
  return u.id;
}

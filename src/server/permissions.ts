import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/driver";
import { profiles } from "@/db/schema";

export type Visibility = "private" | "followers" | "public";

export type Relationship = {
  isSelf: boolean;
  isPrivateAccount: boolean;
  following: boolean; // viewer follows owner (accepted)
  requested: boolean; // viewer has a pending request to owner
  blocked: boolean; // either direction
};

/** Everything about how `viewerId` relates to `ownerId`, in one round trip. */
export async function relationship(viewerId: string | null, ownerId: string): Promise<Relationship> {
  if (viewerId === ownerId) {
    return { isSelf: true, isPrivateAccount: false, following: true, requested: false, blocked: false };
  }
  const v = viewerId ?? "";
  const [row] = await db
    .select({
      isPrivate: profiles.isPrivate,
      followStatus: sql<string | null>`(select status from follows where follower_id = ${v} and followee_id = ${ownerId})`,
      blocked: sql<number>`(select count(*) from blocks where (blocker_id = ${v} and blocked_id = ${ownerId}) or (blocker_id = ${ownerId} and blocked_id = ${v}))`,
    })
    .from(profiles)
    .where(eq(profiles.userId, ownerId));
  return {
    isSelf: false,
    isPrivateAccount: row?.isPrivate ?? false,
    following: row?.followStatus === "accepted",
    requested: row?.followStatus === "pending",
    blocked: (row?.blocked ?? 0) > 0,
  };
}

/** Can the viewer see something the owner marked with `visibility`? */
export function canView(rel: Relationship, visibility: Visibility): boolean {
  if (rel.isSelf) return true;
  if (rel.blocked) return false;
  if (visibility === "private") return false;
  if (visibility === "followers") return rel.following;
  // public: still hidden behind a private account unless you follow
  return !rel.isPrivateAccount || rel.following;
}

export async function canViewUserContent(viewerId: string | null, ownerId: string, visibility: Visibility) {
  return canView(await relationship(viewerId, ownerId), visibility);
}

/** SQL condition: authors whose followers-visible content `viewerId` may see (self + accepted follows, minus blocks). */
export function followedAuthorsClause(viewerId: string, authorCol: ReturnType<typeof sql.raw> | any) {
  return sql`(${authorCol} = ${viewerId} or (${authorCol} in (select followee_id from follows where follower_id = ${viewerId} and status = 'accepted')
    and not exists (select 1 from blocks where (blocker_id = ${viewerId} and blocked_id = ${authorCol}) or (blocker_id = ${authorCol} and blocked_id = ${viewerId}))))`;
}

export { and };

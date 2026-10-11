import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { workouts } from "./training";
import { createdAt, deletedAt, pk, ts, updatedAt } from "./_helpers";

export const mediaAssets = sqliteTable("media_assets", {
  id: pk(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["avatar", "workout_photo", "meal_photo", "progress_photo"] }).notNull(),
  r2Key: text("r2_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  status: text("status", { enum: ["pending", "ready"] }).notNull().default("pending"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    followeeId: text("followee_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["accepted", "pending"] }).notNull().default("accepted"),
    createdAt: createdAt(),
    acceptedAt: ts("accepted_at"),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId, t.status)],
);

export const blocks = sqliteTable(
  "blocks",
  {
    blockerId: text("blocker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const posts = sqliteTable(
  "posts",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["workout", "meal", "day", "progress", "text"] }).notNull(),
    workoutId: text("workout_id").unique().references(() => workouts.id, { onDelete: "cascade" }),
    diaryDate: text("diary_date"),
    body: text("body"),
    visibility: text("visibility", { enum: ["followers", "public"] }).notNull().default("followers"),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("posts_user_created_idx").on(t.userId, t.createdAt), index("posts_created_idx").on(t.createdAt)],
);

export const postMedia = sqliteTable(
  "post_media",
  {
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    mediaId: text("media_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaId] })],
);

export const likes = sqliteTable(
  "likes",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("likes_post_idx").on(t.postId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: pk(),
    postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["like", "comment", "follow", "follow_request", "follow_accepted", "pr"],
    }).notNull(),
    postId: text("post_id"),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/driver";
import { mediaAssets, postMedia, posts, profiles } from "@/db/schema";
import { uuidv7 } from "@/lib/id";
import { badRequest, forbidden, HttpError, notFound } from "../http";
import { canView, relationship } from "../permissions";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const uploadInput = z.object({
  kind: z.enum(["avatar", "workout_photo", "meal_photo", "progress_photo"]),
  mimeType: z.string().refine((t) => t in TYPES, "Only JPEG, PNG and WebP images are supported"),
  sizeBytes: z.number().int().positive().max(MAX_BYTES, "Images can be at most 10 MB"),
});

function r2() {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = process.env;
  if (!account || !accessKeyId || !secretAccessKey || !bucket) {
    throw new HttpError(503, "UPLOADS_NOT_CONFIGURED", "Photo uploads aren't set up yet (R2 credentials missing)");
  }
  const client = new S3Client({ region: "auto", endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  return { client, bucket };
}

export const uploadsConfigured = () => Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

export async function createUpload(userId: string, i: z.infer<typeof uploadInput>) {
  const { client, bucket } = r2();
  const id = uuidv7();
  const key = `${i.kind}/${userId}/${id}.${TYPES[i.mimeType]}`;
  await db.insert(mediaAssets).values({ id, ownerId: userId, kind: i.kind, r2Key: key, mimeType: i.mimeType, sizeBytes: i.sizeBytes, isPublic: i.kind === "avatar" });
  // Content-Type and Content-Length are part of the signature, so the client can't upload something different.
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: i.mimeType, ContentLength: i.sizeBytes }), { expiresIn: 300 });
  return { id, uploadUrl, headers: { "content-type": i.mimeType } };
}

export async function completeUpload(userId: string, id: string) {
  const { client, bucket } = r2();
  const [m] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, userId), isNull(mediaAssets.deletedAt)));
  if (!m) throw notFound("Upload");
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: m.r2Key }));
    if ((head.ContentLength ?? 0) !== m.sizeBytes) throw badRequest("Uploaded file size didn't match", "SIZE_MISMATCH");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw badRequest("The file hasn't finished uploading", "UPLOAD_MISSING");
  }
  await db.update(mediaAssets).set({ status: "ready" }).where(eq(mediaAssets.id, id));
  return { id, status: "ready" as const };
}

/** A short-lived signed URL for an image the viewer is allowed to see. */
export async function signedViewUrl(viewerId: string, id: string) {
  const [m] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.status, "ready"), isNull(mediaAssets.deletedAt)));
  if (!m) throw notFound("Image");
  let allowed = m.ownerId === viewerId || m.kind === "avatar";
  if (!allowed) {
    const [p] = await db.select({ userId: posts.userId, visibility: posts.visibility }).from(postMedia).innerJoin(posts, eq(posts.id, postMedia.postId)).where(and(eq(postMedia.mediaId, id), isNull(posts.deletedAt)));
    if (p) allowed = canView(await relationship(viewerId, p.userId), p.visibility === "public" ? "public" : "followers");
  }
  if (!allowed) throw forbidden();
  const { client, bucket } = r2();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: m.r2Key }), { expiresIn: 300 });
}

export { profiles };

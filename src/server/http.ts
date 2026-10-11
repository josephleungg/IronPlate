import "server-only";
import { z, ZodError, type ZodType } from "zod";
import { auth } from "@/lib/auth";
import { isValidDate } from "@/lib/domain/dates";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}
export const notFound = (what = "Resource") => new HttpError(404, "NOT_FOUND", `${what} not found`);
export const forbidden = (detail = "You don't have access to this") => new HttpError(403, "FORBIDDEN", detail);
export const badRequest = (detail: string, code = "BAD_REQUEST") => new HttpError(400, code, detail);
export const conflict = (detail: string) => new HttpError(409, "CONFLICT", detail);

export const zDate = z.string().refine(isValidDate, "Expected a real date as YYYY-MM-DD");
export const zId = z.string().min(1).max(64);

export type Viewer = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string | null;
};

export async function getViewer(headers: Headers): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { username?: string | null; role?: string | null };
  return { id: u.id, name: u.name, email: u.email, username: u.username ?? null, role: u.role ?? null };
}

export async function requireViewer(headers: Headers): Promise<Viewer> {
  const v = await getViewer(headers);
  if (!v) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue");
  return v;
}

type Params = Record<string, string>;
type Ctx<B, Q> = { req: Request; viewer: Viewer; params: Params; body: B; query: Q };
type PublicCtx<B, Q> = Omit<Ctx<B, Q>, "viewer"> & { viewer: Viewer | null };

type Config<B, Q> = { body?: ZodType<B>; query?: ZodType<Q> };

function problem(status: number, code: string, detail: string, extra?: Record<string, unknown>) {
  return Response.json(
    { type: `https://ironplate.app/problems/${code.toLowerCase()}`, title: code, status, detail, code, ...extra },
    { status, headers: { "content-type": "application/problem+json", "cache-control": "no-store" } },
  );
}

async function parse<B, Q>(req: Request, cfg: Config<B, Q>) {
  let body = undefined as B;
  let query = undefined as Q;
  if (cfg.body) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw badRequest("Request body must be valid JSON", "INVALID_JSON");
    }
    body = cfg.body.parse(raw);
  }
  if (cfg.query) query = cfg.query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return { body, query };
}

function wrap<B, Q>(cfg: Config<B, Q>, run: (req: Request, params: Params, body: B, query: Q) => Promise<unknown>) {
  return async (req: Request, ctx?: { params?: Promise<Params> }): Promise<Response> => {
    try {
      const params = (await ctx?.params) ?? {};
      const { body, query } = await parse(req, cfg);
      const out = await run(req, params, body, query);
      if (out instanceof Response) return out;
      if (out === undefined) return new Response(null, { status: 204 });
      return Response.json(out, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return problem(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        return problem(400, "VALIDATION_FAILED", "Request validation failed", {
          errors: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      console.error("[api] unhandled", req.method, new URL(req.url).pathname, e);
      return problem(500, "INTERNAL", "Something went wrong");
    }
  };
}

/** Authenticated route. Validates body/query with Zod and renders errors as problem+json. */
export function route<B = undefined, Q = undefined>(cfg: Config<B, Q>, fn: (c: Ctx<B, Q>) => Promise<unknown>) {
  return wrap(cfg, async (req, params, body, query) => {
    const viewer = await requireViewer(req.headers);
    return fn({ req, viewer, params, body, query });
  });
}

/** Route that works signed-out (viewer may be null). */
export function publicRoute<B = undefined, Q = undefined>(cfg: Config<B, Q>, fn: (c: PublicCtx<B, Q>) => Promise<unknown>) {
  return wrap(cfg, async (req, params, body, query) => {
    const viewer = await getViewer(req.headers);
    return fn({ req, viewer, params, body, query });
  });
}

export const created = (data: unknown) => Response.json(data, { status: 201, headers: { "cache-control": "no-store" } });

/** Pagination: opaque cursors are base64url(JSON). */
export const zLimit = z.coerce.number().int().min(1).max(100).default(20);
export const encodeCursor = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
export function decodeCursor<T>(c: string | undefined): T | null {
  if (!c) return null;
  try {
    return JSON.parse(Buffer.from(c, "base64url").toString()) as T;
  } catch {
    throw badRequest("Invalid cursor", "INVALID_CURSOR");
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Init = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

/** Fetch wrapper for /api/v1. Throws ApiError with the server's plain-language message. */
export async function api<T = unknown>(path: string, init: Init = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A full navigation on purpose: it clears all client state when the session has ended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/sign-in";
    const detail = data?.errors?.[0] ? `${data.errors[0].path ? data.errors[0].path + ": " : ""}${data.errors[0].message}` : data?.detail;
    throw new ApiError(res.status, data?.code ?? "ERROR", detail ?? "Something went wrong. Try again.");
  }
  return data as T;
}

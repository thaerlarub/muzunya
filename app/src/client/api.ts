// Tiny fetch wrapper. Adds the CSRF header and throws ApiError on non-2xx.
export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
let csrf = "";
export const setCsrf = (t: string) => { csrf = t; };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") (init.headers as Record<string, string>)["X-CSRF-Token"] = csrf;
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const r = await fetch(path, init);
  if (!r.ok) {
    let code = "error";
    try { code = (await r.json()).error || code; } catch {}
    throw new ApiError(r.status, code);
  }
  return r.json() as Promise<T>;
}
export const api = {
  get: <T>(p: string) => req<T>("GET", p),
  post: <T>(p: string, b?: unknown) => req<T>("POST", p, b ?? {}),
  put: <T>(p: string, b?: unknown) => req<T>("PUT", p, b ?? {}),
  del: <T>(p: string) => req<T>("DELETE", p),
};
export const photoUrl = (id: string) => `/api/photos/${encodeURIComponent(id)}`;

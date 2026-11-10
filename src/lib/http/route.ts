// Server-only through `@/lib/supabase/server`, which starts with `import "server-only"`. It is
// not imported here directly because Vitest resolves that package to its throwing entry point,
// and the route tests mock the Supabase module instead.
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NO_STORE = { "cache-control": "no-store" };

/** A JSON response no cache may keep: every API answer is per-player or live. */
export function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** The API's error shape, `{ error: code }`. */
export function errorResponse(status: number, code: string): NextResponse {
  return jsonNoStore({ error: code }, status);
}

/** Either the value a handler needs, or the response to send instead. */
export type Outcome<T> = T | { response: NextResponse };

/** The signed-in user, or a ready 401. */
export async function requireUser(): Promise<Outcome<{ user: User }>> {
  // getUser checks the session with the Auth server, so a forged cookie is rejected.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user } : { response: errorResponse(401, "unauthenticated") };
}

/**
 * The parsed JSON body, or a ready 413 (`too-large`, by declared or actual size in bytes) or 400
 * (`invalid-body`). A body declared too large is refused before it is read.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<Outcome<{ body: unknown }>> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return { response: errorResponse(413, "too-large") };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { response: errorResponse(413, "too-large") };
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { response: errorResponse(400, "invalid-body") };
  }
}

/** Wraps a handler so a thrown error is logged under `label` and answered with a bare 500. */
export function withServerErrors<Args extends unknown[]>(
  label: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(label, error);
      return errorResponse(500, "server-error");
    }
  };
}

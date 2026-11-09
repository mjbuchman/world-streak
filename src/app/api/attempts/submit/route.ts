import { NextResponse } from "next/server";
import { supabaseSubmitStore } from "@/lib/attempts/store";
import { submitAttempt } from "@/lib/attempts/submit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NO_STORE = { "cache-control": "no-store" };

// A full stacking run (at most 200 taps) is a few KB; anything far larger is refused unparsed.
const MAX_BODY_BYTES = 64 * 1024;

const error = (status: number, code: string) => NextResponse.json({ error: code }, { status, headers: NO_STORE });

/**
 * POST /api/attempts/submit with `{ attemptId, inputs }`: the server replays the engine on the
 * attempt's seed, decides pass or fail, and stores the result once. See `submitAttempt` for
 * every status it can answer.
 */
export async function POST(request: Request) {
  // getUser checks the session with the Auth server, so a forged cookie is rejected.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error(401, "unauthenticated");

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return error(413, "too-large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error(413, "too-large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "invalid-body");
  }

  try {
    const result = await submitAttempt({
      userId: user.id,
      body,
      now: new Date(),
      store: supabaseSubmitStore(createSupabaseAdminClient()),
    });
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (cause) {
    console.error("Submitting an attempt failed", cause);
    return error(500, "server-error");
  }
}

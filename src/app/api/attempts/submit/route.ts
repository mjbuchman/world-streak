import { supabaseAttemptStore } from "@/lib/attempts/store";
import { submitAttempt } from "@/lib/attempts/submit";
import { jsonNoStore, readJsonBody, requireUser, withServerErrors } from "@/lib/http/route";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// A full stacking run (at most 200 taps) is a few KB; anything far larger is refused unparsed.
const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/attempts/submit with `{ attemptId, inputs }`: the server replays the engine on the
 * attempt's seed, decides pass or fail, and stores the result once. See `submitAttempt` for
 * every status it can answer.
 */
export const POST = withServerErrors("Submitting an attempt failed", async (request: Request) => {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if ("response" in read) return read.response;

  const { status, body } = await submitAttempt({
    userId: auth.user.id,
    body: read.body,
    now: new Date(),
    store: supabaseAttemptStore(createSupabaseAdminClient()),
  });
  return jsonNoStore(body, status);
});

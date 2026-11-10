import { startAttempt } from "@/lib/attempts/start";
import { supabaseAttemptStore } from "@/lib/attempts/store";
import { jsonNoStore, requireUser, withServerErrors } from "@/lib/http/route";
import { secureRandomSeed } from "@/lib/random";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/attempts/start: issues today's scored attempt (its seed and challenge parameters)
 * to the signed-in player. It takes no body: the player, day and seed all come from the server.
 */
export const POST = withServerErrors("Starting an attempt failed", async () => {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { status, body } = await startAttempt({
    userId: auth.user.id,
    now: new Date(),
    store: supabaseAttemptStore(createSupabaseAdminClient()),
    randomSeed: secureRandomSeed,
  });
  return jsonNoStore(body, status);
});

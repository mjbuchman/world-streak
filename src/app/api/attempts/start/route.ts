import { NextResponse } from "next/server";
import { startAttempt } from "@/lib/attempts/start";
import { supabaseAttemptStore } from "@/lib/attempts/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NO_STORE = { "cache-control": "no-store" };

/** A seed from the platform's secure random source, so no player can predict another's. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/**
 * POST /api/attempts/start: issues today's scored attempt (its seed and challenge parameters)
 * to the signed-in player. It takes no body: the player, day and seed all come from the server.
 */
export async function POST() {
  // getUser checks the session with the Auth server, so a forged cookie is rejected.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });

  try {
    const { status, body } = await startAttempt({
      userId: user.id,
      now: new Date(),
      store: supabaseAttemptStore(createSupabaseAdminClient()),
      randomSeed,
    });
    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (error) {
    console.error("Starting an attempt failed", error);
    return NextResponse.json({ error: "server-error" }, { status: 500, headers: NO_STORE });
  }
}

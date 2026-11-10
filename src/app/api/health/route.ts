import { checkDatabase } from "@/lib/health";
import { jsonNoStore } from "@/lib/http/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public on purpose: a liveness probe for monitoring. It takes no input and reveals only
// whether the database answers, so it is exempt from the authentication requirement. It needs no
// withServerErrors: checkDatabase turns any failure into a 503 itself.
export async function GET() {
  const { status, body } = await checkDatabase(async () =>
    (await createSupabaseServerClient()).rpc("health_check"),
  );
  return jsonNoStore(body, status);
}

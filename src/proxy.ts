import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next.js 16 renamed "middleware" to "proxy"; this runs before every matched request.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files, images and the public meter (its answers are cached for everyone, so it
  // must never refresh a session or set a cookie); everything else gets a fresh session. The `$`
  // after api/meter matters: without it /api/meters or a future /api/meter/... would skip too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/meter$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

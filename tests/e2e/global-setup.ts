import { chromium, type FullConfig, type Page } from "@playwright/test";
import { gameDateAt } from "../../src/lib/gameDay";
import { E2E_PASSWORD, gotoReady, signUpViaForm, submitAndWait } from "./support/pages";
import { adminClient, deleteUsersByEmail } from "./support/supabase";

/** Pages a visitor opens. */
export const VISITOR_PATHS = ["/", "/signin", "/signup", "/rules", "/practice", "/practice/stacking", "/practice/inner-clock", "/practice/flash-count", "/practice/echo-path", "/practice/fair-split", "/practice/ink", "/history", "/admin", "/auth/callback?error=warmup"] as const;
/** Pages a signed-in player opens. */
export const PLAYER_PATHS = ["/", "/play", "/complete-profile", "/history"] as const;
/** Pages the admin opens. */
export const ADMIN_PATHS = ["/admin", "/admin/settings", "/admin/flags", "/admin/draw"] as const;

// The local-only admin from supabase/seed.sql (as in admin.spec.ts). Without the seed, the
// warm-up fails at this sign-in; apply it with `npx supabase db query -f supabase/seed.sql`.
const ADMIN = { email: "admin@local.test", password: "admin-local-only" };

/** Opens each path in turn and waits for it to hydrate (so its server and client code are compiled). */
export async function warm(page: Page, paths: readonly string[]): Promise<void> {
  for (const path of paths) await gotoReady(page, path);
}

/** Signs in through the form (the sign-in action), landing on the home page. */
async function signIn(page: Page, email: string, password: string): Promise<void> {
  await gotoReady(page, "/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submitAndWait(page, page.getByRole("main").getByRole("button", { name: "Sign in" }));
  await page.waitForURL((url) => url.pathname === "/");
}

async function signOut(page: Page): Promise<void> {
  await submitAndWait(page, page.getByRole("banner").getByRole("button", { name: "Sign out" }));
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).waitFor();
}

/** Before the workers start: pin today to the Tower, and warm the dev server locally. Playwright runs the returned step after them. */
export default async function globalSetup(config: FullConfig): Promise<() => Promise<void>> {
  const restoreToday = await pinTowerToday();
  if (!process.env.CI) await warmUp(config);
  return restoreToday;
}

/**
 * Most specs play today as the Tower, so the run makes it today's first game (the one /play
 * plays until T154), in CI too, marked edited as an admin's choice would be so the lineup rule
 * (T151) leaves it alone. Specs about another challenge set their day themselves
 * (tests/e2e/after/). Returns the step that puts it back once the specs' accounts are gone.
 */
async function pinTowerToday(): Promise<() => Promise<void>> {
  const db = adminClient();
  const today = gameDateAt(new Date());
  const ensured = await db.rpc("ensure_game_day", { d: today });
  if (ensured.error) throw ensured.error;
  const day = await db.from("game_days").select("survival_threshold, edited").eq("game_date", today).single();
  if (day.error) throw day.error;
  const lineup = await db.from("game_day_games").select("challenge_type, pass_target").eq("game_date", today).order("position");
  if (lineup.error) throw lineup.error;
  const games = lineup.data.map((game) => game.challenge_type);
  const targets = lineup.data.map((game) => Number(game.pass_target));
  const save = async (lineupGames: string[]) => {
    // A slot whose game changes while its target stays gets the new game's default (T161).
    const saved = await db.rpc("save_game_day", { d: today, games: lineupGames, targets, threshold: day.data.survival_threshold });
    if (saved.error) throw saved.error;
  };
  await save(["stacking", ...games.filter((game) => game !== "stacking")].slice(0, 3));
  return async () => {
    // A day still holding attempts has its games locked (T111), so it stays the Tower.
    const left = await db.from("attempts").select("id", { count: "exact", head: true }).eq("game_date", today);
    if (left.error) throw left.error;
    if (left.count) return;
    await save(games);
    const restored = await db.from("game_days").update({ edited: day.data.edited }).eq("game_date", today);
    if (restored.error) throw restored.error;
  };
}

/**
 * Compiles everything the suite uses against the dev server (T78): every page, API route and
 * server action. Something compiled in the middle of a parallel run makes the dev server rebuild,
 * which stalls other workers' in-flight sign-ups past their waits. CI runs a production build,
 * where everything is compiled up front, so it skips this.
 */
async function warmUp(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch();
  const email = `e2e-warmup-${Date.now()}@example.com`;
  try {
    const page = await browser.newPage({ baseURL });
    // A cold first compile can take a while; the tests' own waits stay as they are.
    page.setDefaultTimeout(120_000);
    await warm(page, VISITOR_PATHS);
    // The API routes, answered without a session (401) or as public data.
    for (const path of ["/api/attempts/start", "/api/attempts/submit"]) await page.request.post(path, { data: {} });
    for (const path of ["/api/meter", "/api/health"]) await page.request.get(path);

    // A player: the sign-up, sign-out and sign-in actions, and the signed-in pages (the game on /play).
    await signUpViaForm(page, { email });
    await page.waitForURL((url) => url.pathname === "/");
    await warm(page, PLAYER_PATHS);
    await signOut(page);
    await signIn(page, email, E2E_PASSWORD);
    await signOut(page);

    // The admin pages and their actions (T216): compiled mid-run, they made admin.spec's sign-ins time out.
    await signIn(page, ADMIN.email, ADMIN.password);
    await warm(page, ADMIN_PATHS);
  } finally {
    await browser.close();
    await deleteUsersByEmail([email]);
  }
}

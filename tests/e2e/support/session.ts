import type { BrowserContext, Cookie } from "@playwright/test";

/** Supabase stores the session in sb-<project>-auth-token, split into .0, .1, ... when large. */
export const AUTH_COOKIE = /^sb-.*-auth-token(\.\d+)?$/;

export type StoredSession = { access_token: string; refresh_token: string; expires_at: number };

async function authCookies(context: BrowserContext): Promise<Cookie[]> {
  return (await context.cookies())
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
}

/** Decodes the session the browser currently holds ("base64-" + base64url JSON). */
export async function readSession(context: BrowserContext): Promise<StoredSession> {
  const value = (await authCookies(context)).map((cookie) => cookie.value).join("");
  return JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64url").toString("utf8"));
}

/** Replaces the browser's session cookie(s) with one holding the given session. */
export async function writeSession(context: BrowserContext, session: StoredSession): Promise<void> {
  const [first] = await authCookies(context);
  if (!first) throw new Error("No Supabase session cookie to replace; sign in first.");
  await context.clearCookies({ name: AUTH_COOKIE });
  await context.addCookies([
    {
      ...first,
      name: first.name.replace(/\.\d+$/, ""),
      value: `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`,
    },
  ]);
}

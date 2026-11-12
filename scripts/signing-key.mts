/**
 * Creates the LOCAL Supabase's JWT signing key (`supabase/signing_keys.json`, git-ignored) if it
 * is missing; `npm run db:start` runs it first. With an asymmetric key, `getClaims()` verifies a
 * session locally instead of asking the Auth server on every page (T58). Production uses the key
 * set up in the Supabase dashboard (docs/DEPLOYMENT.md), never this file.
 */
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SIGNING_KEYS_FILE = "supabase/signing_keys.json";

/** An ES256 private JWK in the shape `supabase gen signing-key` prints. */
export function newSigningKey() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const { crv, d, x, y } = privateKey.export({ format: "jwk" });
  return { kty: "EC", kid: randomUUID(), use: "sig", key_ops: ["sign", "verify"], alg: "ES256", ext: true, d, crv, x, y };
}

/** Never replaces an existing key: that would sign every local player out. */
export function ensureSigningKeys(file: string = SIGNING_KEYS_FILE): "created" | "kept" {
  if (existsSync(file)) return "kept";
  writeFileSync(file, `${JSON.stringify([newSigningKey()], null, 2)}\n`);
  return "created";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (ensureSigningKeys() === "created") console.log(`Created ${SIGNING_KEYS_FILE} (local JWT signing key).`);
}

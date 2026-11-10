/**
 * A seed from the platform's secure random source (Web Crypto, available in browsers and on the
 * server), so no player can predict another's. Safe in client components too (practice uses it).
 * Engines stay pure: callers pass the seed in.
 */
export function secureRandomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

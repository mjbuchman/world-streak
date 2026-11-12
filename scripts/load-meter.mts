/**
 * Load test for the meter endpoint (T48): `npm run load:meter` sends 200 connections at
 * /api/meter for 30 s and prints the p95 latency. Run it against a LOCAL production build
 * (`npm run build`, then `npm run start -- -p 3200`); LOAD_URL picks the server
 * (default http://localhost:3200), and anything but localhost is refused.
 */
import autocannon from "autocannon";
import { pathToFileURL } from "node:url";

export const LOAD = { connections: 200, durationSeconds: 30 } as const;
const DEFAULT_URL = "http://localhost:3200";

/** Throws unless `url` is on this machine: a load test must never hit a real deployment. */
export function assertLocalTarget(url: string): URL {
  const target = new URL(url);
  if (target.hostname !== "localhost" && target.hostname !== "127.0.0.1") {
    throw new Error(`Refusing to load-test ${target.origin}: only localhost or 127.0.0.1.`);
  }
  return target;
}

/** The `p`th percentile (0-100) of `samples` by the nearest-rank method; null with no samples. */
export function percentile(samples: readonly number[], p: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** One line per figure the README records, latencies in whole milliseconds. */
export function summary(times: readonly number[], non2xx: number, errors: number): string[] {
  const ms = (p: number) => {
    const value = percentile(times, p);
    return value === null ? "-" : String(Math.round(value));
  };
  return [
    `Requests: ${times.length} (${Math.round(times.length / LOAD.durationSeconds)}/s), non-2xx: ${non2xx}, errors: ${errors}`,
    `p50 ${ms(50)} ms, p95 ${ms(95)} ms, p99 ${ms(99)} ms (target: p95 under 200 ms locally)`,
  ];
}

async function main(env: Record<string, string | undefined>): Promise<void> {
  const target = assertLocalTarget(env.LOAD_URL ?? DEFAULT_URL);
  const times: number[] = [];
  const options = { url: new URL("/api/meter", target).href, connections: LOAD.connections, duration: LOAD.durationSeconds };
  // The callback form returns the running instance, whose responses carry each latency.
  const result = await new Promise<autocannon.Result>((resolve, reject) => {
    const instance = autocannon(options, (error, done) => (error ? reject(error) : resolve(done)));
    instance.on("response", (_client, _status, _bytes, responseTime) => times.push(responseTime));
  });
  for (const line of summary(times, result.non2xx, result.errors)) console.log(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.env).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export type HealthResult =
  | { status: 200; body: { db: "ok" } }
  | { status: 503; body: { db: "unavailable" } };

type ProbeResult = { data: unknown; error: unknown };

/** Runs a database probe and maps any failure (error, wrong answer, exception) to 503. */
export async function checkDatabase(probe: () => PromiseLike<ProbeResult>): Promise<HealthResult> {
  try {
    const { data, error } = await probe();
    if (!error && data === true) return { status: 200, body: { db: "ok" } };
  } catch {
    // Missing configuration or an unreachable database: both mean "unavailable".
  }
  return { status: 503, body: { db: "unavailable" } };
}

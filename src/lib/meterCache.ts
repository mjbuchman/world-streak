// The meter endpoint's own cache (T48): a traffic spike that gets past the CDN still costs one
// database read per window, and a database outage still shows the last good reading for a while.
import { METER_STALE_MAX_SECONDS } from "@/config/meter";
import { type MeterBody, meterCacheSeconds, meterOutOfDateAt } from "./meter";

export type MeterAnswer = { body: MeterBody; stale: boolean };

type Good = { body: MeterBody; readAt: number; freshUntil: number };

/**
 * A cache with at most one read in flight. A good reading is reused for as long as a CDN may keep
 * it (`meterCacheSeconds`, which already keeps clear of the moment it goes out of date). When a
 * read fails, the last good reading is served as stale for up to METER_STALE_MAX_SECONDS after it
 * was read, but never once it is out of date; otherwise the answer is null (the endpoint's 503).
 */
export function createMeterCache({ read, now }: { read: () => Promise<MeterBody>; now: () => Date }) {
  let good: Good | null = null;
  let inFlight: Promise<MeterAnswer | null> | null = null;

  const staleOrNothing = (at: number): MeterAnswer | null => {
    if (!good || at - good.readAt > METER_STALE_MAX_SECONDS * 1000 || at >= meterOutOfDateAt(good.body).getTime()) return null;
    return { body: good.body, stale: true };
  };

  const refresh = async (): Promise<MeterAnswer | null> => {
    try {
      const body = await read();
      const readAt = now();
      good = { body, readAt: readAt.getTime(), freshUntil: readAt.getTime() + meterCacheSeconds(body, readAt) * 1000 };
      return { body, stale: false };
    } catch (error) {
      console.error("Reading the meter failed", error);
      return staleOrNothing(now().getTime());
    }
  };

  return {
    async get(): Promise<MeterAnswer | null> {
      if (good && now().getTime() < good.freshUntil) return { body: good.body, stale: false };
      // Cleared once the stored promise settles, so even a read that throws before its first
      // await (a missing key) cannot leave a finished read standing as the one in flight.
      inFlight ??= refresh().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}

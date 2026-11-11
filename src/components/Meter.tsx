"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { METER_HIDE_HOURS, METER_POLL_SECONDS } from "@/config/meter";
import { isMeterBody, meterHiddenFrom, meterHiddenMessage, type MeterBody } from "@/lib/meter";
import styles from "./Meter.module.css";
import { useNow } from "./useNow";

const UNAVAILABLE = "The meter is unavailable right now.";
const EYEBROW = "Today, the whole world";

const percent = (fraction: number) => Math.round(fraction * 100);

type OpenBody = Extract<MeterBody, { status: "open" }>;

const attemptCount = (attempts: number) => `${attempts.toLocaleString("en-US")} ${attempts === 1 ? "attempt" : "attempts"}`;

/** "72% passing · 60% needed · 1,234 attempts", leaving out whatever is not known yet. */
function label(body: OpenBody): string {
  const parts = [body.passRate === null ? "No attempts yet" : `${percent(body.passRate)}% passing`];
  if (body.threshold !== null) parts.push(`${percent(body.threshold)}% needed`);
  if (body.attempts > 0) parts.push(attemptCount(body.attempts));
  return parts.join(" · ");
}

/**
 * Where today stands against the line: the colours follow the real comparison (the one the close
 * makes), the words the rounded numbers on screen, so it never says "on the line" while below it.
 */
function standing(passRate: number, threshold: number): { state: "above" | "below"; verdict: string } {
  const state = passRate >= threshold ? "above" : "below";
  const gap = Math.abs(percent(passRate) - percent(threshold));
  if (gap === 0) return { state, verdict: state === "above" ? "Right on the line" : "Just below the line" };
  return { state, verdict: `${gap} ${gap === 1 ? "point" : "points"} ${state} the line` };
}

// The gauge: a half circle of radius 135 around (150, 150), drawn left to right, 30 wide.
const ARC = "M 15 150 A 135 135 0 0 1 285 150";
/** The arc's path length as drawn (`pathLength`), so a dash of N covers N%. */
const ARC_LENGTH = 100;
/** The half circle is 180 degrees for 100%. */
const DEGREES_PER_PERCENT = 1.8;

/**
 * Fetches /api/meter now and every METER_POLL_SECONDS, but only while the tab is visible.
 * `reload` asks again at once (used when the day closes).
 */
function useMeterReading(): { body: MeterBody | null; failed: boolean; reload: () => Promise<void> } {
  const [body, setBody] = useState<MeterBody | null>(null);
  const [failed, setFailed] = useState(false);
  // Only the newest request may update the meter, so a slow older reply cannot overwrite it.
  const latest = useRef(0);
  const active = useRef(true);

  const load = useCallback(async () => {
    const request = ++latest.current;
    const settle = (apply: () => void) => {
      if (active.current && request === latest.current) apply();
    };
    try {
      const response = await fetch("/api/meter");
      if (!response.ok) throw new Error(`Meter answered ${response.status}`);
      const reading: unknown = await response.json();
      if (!isMeterBody(reading)) throw new Error("Malformed meter reading");
      settle(() => {
        setBody(reading);
        setFailed(false);
      });
    } catch {
      // Keep showing the last good reading; only an empty meter says it is unavailable.
      settle(() => setFailed(true));
    }
  }, []);

  useEffect(() => {
    active.current = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      void load();
      timer = setInterval(() => void load(), METER_POLL_SECONDS * 1000);
    };
    const onVisibilityChange = () => (document.visibilityState === "visible" ? start() : stop());

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active.current = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  // `load` is stable (useCallback), so effects that depend on `reload` do not re-run every render.
  return { body, failed, reload: load };
}

/** The gauge's frame: the surface whose glow takes the state's colour, and the eyebrow. */
function Frame({ state, children }: { state: "above" | "below" | "none"; children: ReactNode }) {
  return (
    <section aria-label="Today's meter" className={styles.meter} data-state={state}>
      <p className={styles.eyebrow}>{EYEBROW}</p>
      {children}
    </section>
  );
}

/**
 * The live meter: today's pass rate on a half-circle gauge against the survival threshold. With a
 * hidden window (METER_HIDE_HOURS > 0) it shows only the hidden message in the final hours,
 * switching by its own clock so a cached reading from just before the window is never shown inside
 * it. The countdown to the deadline is the page header's (Countdown).
 */
export function Meter() {
  const { body, failed, reload } = useMeterReading();
  const now = useNow();

  // When the day closes, ask for the next day's reading at once rather than at the next poll:
  // once per deadline (a cached reply from just before midnight may still carry it), and only
  // while the tab is visible (coming back to the tab fetches anyway).
  const closesAtMs = body ? Date.parse(body.closesAt) : null;
  const closed = closesAtMs !== null && now !== null && now >= closesAtMs;
  const reloadedFor = useRef<number | null>(null);
  useEffect(() => {
    if (closed && reloadedFor.current !== closesAtMs && document.visibilityState === "visible") {
      reloadedFor.current = closesAtMs;
      void reload();
    }
  }, [closed, closesAtMs, reload]);

  if (!body || closesAtMs === null) {
    return (
      <Frame state="none">
        <p className={styles.status}>{failed ? UNAVAILABLE : "Loading today’s meter…"}</p>
      </Frame>
    );
  }

  // With no window, the moment of the deadline is not "hidden": the reload above takes over.
  const hiddenByClock = METER_HIDE_HOURS > 0 && now !== null && now >= meterHiddenFrom(body.closesAt).getTime();
  if (body.status !== "open" || hiddenByClock) {
    return (
      <Frame state="none">
        <p className={styles.hidden}>{meterHiddenMessage(METER_HIDE_HOURS)}</p>
      </Frame>
    );
  }

  const rate = body.passRate === null ? 0 : percent(body.passRate);
  const where = body.passRate !== null && body.threshold !== null ? standing(body.passRate, body.threshold) : null;
  return (
    <Frame state={where?.state ?? "none"}>
      <div
        className={styles.gauge}
        role="meter"
        aria-label="Today's pass rate"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
        aria-valuetext={label(body)}
      >
        <svg viewBox="0 0 300 165" className={styles.arc} aria-hidden="true">
          <path d={ARC} className={styles.track} pathLength={ARC_LENGTH} />
          <path
            d={ARC}
            className={styles.fill}
            pathLength={ARC_LENGTH}
            strokeDasharray={`${rate} ${ARC_LENGTH}`}
            data-gauge-fill=""
          />
          {body.threshold !== null && (
            // Drawn across the left end (0%) and turned about the centre.
            <line
              x1={-10}
              y1={150}
              x2={42}
              y2={150}
              className={styles.tick}
              transform={`rotate(${percent(body.threshold) * DEGREES_PER_PERCENT} 150 150)`}
              data-gauge-tick=""
            />
          )}
        </svg>
        <div className={styles.reading}>
          {body.passRate === null ? (
            <p className={styles.empty}>No attempts yet</p>
          ) : (
            <>
              <p className={styles.rate}>{rate}%</p>
              <p className={styles.caption}>passing right now</p>
            </>
          )}
        </div>
      </div>
      {where && <p className={styles.verdict}>{where.verdict}</p>}
      {(body.threshold !== null || body.attempts > 0) && (
        <div className={styles.counts}>
          {body.threshold !== null && (
            <p className={styles.needed}>
              <span className={styles.swatch} aria-hidden="true" />
              {percent(body.threshold)}% needed
            </p>
          )}
          {body.attempts > 0 && <p>{attemptCount(body.attempts)}</p>}
        </div>
      )}
    </Frame>
  );
}

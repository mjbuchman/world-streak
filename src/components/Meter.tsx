"use client";

import { useEffect, useState } from "react";
import { METER_HIDE_HOURS, METER_POLL_SECONDS } from "@/config/meter";
import { meterHiddenFrom, type MeterBody } from "@/lib/meter";
import styles from "./Meter.module.css";

const HIDDEN_MESSAGE = `The meter is hidden for the final ${METER_HIDE_HOURS} hours. The result is revealed at the deadline.`;
const UNAVAILABLE = "The meter is unavailable right now.";

const percent = (fraction: number) => Math.round(fraction * 100);

/** "72% passing · 60% needed · 1,234 attempts", leaving out whatever is not known yet. */
function label(body: Extract<MeterBody, { status: "open" }>): string {
  const parts = [body.passRate === null ? "No attempts yet" : `${percent(body.passRate)}% passing`];
  if (body.threshold !== null) parts.push(`${percent(body.threshold)}% needed`);
  if (body.attempts > 0) parts.push(`${body.attempts.toLocaleString("en-US")} ${body.attempts === 1 ? "attempt" : "attempts"}`);
  return parts.join(" · ");
}

/** h:mm:ss until the deadline, never below zero. */
function countdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/** Fetches /api/meter now and every METER_POLL_SECONDS, but only while the tab is visible. */
function useMeterReading(): { body: MeterBody | null; failed: boolean } {
  const [body, setBody] = useState<MeterBody | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const response = await fetch("/api/meter");
        if (!response.ok) throw new Error(`Meter answered ${response.status}`);
        const reading = (await response.json()) as MeterBody;
        if (active) {
          setBody(reading);
          setFailed(false);
        }
      } catch {
        // Keep showing the last good reading; only an empty meter says it is unavailable.
        if (active) setFailed(true);
      }
    }
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
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return { body, failed };
}

/** The current time, ticking every second, for the countdown and the hidden window. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The live meter: today's pass rate against the survival threshold, with a countdown to the
 * deadline. In the final hours it shows only the hidden message, switching by its own clock so a
 * cached reading from just before the window is never shown inside it.
 */
export function Meter() {
  const { body, failed } = useMeterReading();
  const now = useNow();

  if (!body) {
    return (
      <section className={styles.meter} aria-label="Today's meter">
        <p className={styles.status}>{failed ? UNAVAILABLE : "Loading today’s meter…"}</p>
      </section>
    );
  }

  const hidden = body.status === "hidden" || now >= meterHiddenFrom(body.closesAt).getTime();
  const timer = (
    <p className={styles.countdown} role="timer">
      {`Closes in ${countdown(new Date(body.closesAt).getTime() - now)}`}
    </p>
  );

  if (hidden || body.status !== "open") {
    return (
      <section className={styles.meter} aria-label="Today's meter">
        <p className={styles.hidden}>{HIDDEN_MESSAGE}</p>
        {timer}
      </section>
    );
  }

  const rate = body.passRate === null ? 0 : percent(body.passRate);
  const text = label(body);
  return (
    <section className={styles.meter} aria-label="Today's meter">
      <div
        className={styles.track}
        role="meter"
        aria-label="Today's pass rate"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
        aria-valuetext={body.passRate === null ? "No attempts yet" : text}
      >
        <div className={styles.fill} data-meter-fill style={{ width: `${rate}%` }} />
        {body.threshold !== null && (
          <div className={styles.marker} data-meter-marker style={{ left: `${percent(body.threshold)}%` }} />
        )}
      </div>
      <p className={styles.label}>{text}</p>
      {timer}
    </section>
  );
}

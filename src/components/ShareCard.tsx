"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { gameDateAt } from "@/lib/gameDay";
import { isMeterBody, type MeterBody } from "@/lib/meter";
import { buildShareText } from "@/lib/share";
import styles from "./ShareCard.module.css";

type ShareCardProps = {
  passed: boolean;
  /** The link in the text; by default NEXT_PUBLIC_SITE_URL, else this page's origin. */
  siteUrl?: string;
  /** For tests: the time the card falls back to for today's date when the meter cannot be read. */
  now?: Date;
};

/** Today's meter, once; null if it cannot be read (the card still works without it). */
function useMeterOnce(): { meter: MeterBody | null; loaded: boolean } {
  const [state, setState] = useState<{ meter: MeterBody | null; loaded: boolean }>({ meter: null, loaded: false });
  useEffect(() => {
    let active = true;
    fetch("/api/meter")
      .then(async (response) => {
        const body: unknown = response.ok ? await response.json() : null;
        return isMeterBody(body) ? body : null;
      })
      .catch(() => null)
      .then((meter) => {
        if (active) setState({ meter, loaded: true });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

/**
 * The spoiler-free card under today's result (T32): the outcome, the world streak and how the
 * world is doing, never the score. Share uses the device's share sheet, else copies the text.
 */
export function ShareCard({ passed, siteUrl, now }: ShareCardProps) {
  const { meter, loaded } = useMeterOnce();
  const [status, setStatus] = useState<string | null>(null);
  // Nothing until the meter read settles, which only happens in the browser (so `window` is there).
  if (!loaded) return null;

  const text = buildShareText({
    passed,
    gameDate: meter?.gameDate ?? gameDateAt(now ?? new Date()),
    streak: meter?.streak.current ?? null,
    meter,
    siteUrl: siteUrl ?? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin),
  });

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
      } catch {
        // Closing the share sheet is not an error worth showing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
    } catch {
      setStatus("Could not copy. Select the text and copy it.");
    }
  }

  return (
    <Surface as="section" aria-label="Share your day">
      <pre className={styles.text}>{text}</pre>
      <Button variant="secondary" onClick={share}>
        Share
      </Button>
      {status && (
        <p role="status" className={styles.status}>
          {status}
        </p>
      )}
    </Surface>
  );
}

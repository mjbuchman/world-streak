"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { FlashCountInputs, FlashCountParams } from "@/challenges/flash-count/engine";
import { dotsVisible, drawFlashCount } from "@/challenges/flash-count/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { FLASH_COUNT_COLOR_TOKENS } from "@/components/canvasTokens";
import { runFrames } from "@/components/frameLoop";
import { Field, TextInput } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import styles from "./FlashCountGame.module.css";

const INVALID = "Enter a whole number from 0 to 999.";

/** A typed answer as a count, or null unless it is a whole number from 0 to 999. */
function parseCount(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,3}$/.test(trimmed) ? Number(trimmed) : null;
}

type FlashCountGameProps = {
  params: FlashCountParams;
  onFinish: (inputs: FlashCountInputs) => void;
  /** How long the 3-2-1 lasts; 0 skips it (tests of the flash alone). */
  countdownMs?: number;
};

/** Each number of the 3-2-1 before the dots (T119). */
export const COUNTDOWN_STEP_MS = 800;
const COUNTDOWN_FROM = 3;

/**
 * A Swift Sum run: a 3-2-1 countdown builds up to the flash (T119), counted from the first frame
 * after the canvas is on screen. Right after "1" the dots stay for `flashMs` of elapsed time
 * (whatever the frame rate), then the board clears and the player enters how many there were. If
 * the tab is hidden before the dots have cleared, the countdown and the flash start over on return,
 * so a scored player always gets the whole flash.
 */
export function FlashCountGame({ params, onFinish, countdownMs = COUNTDOWN_FROM * COUNTDOWN_STEP_MS }: FlashCountGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showing, setShowing] = useState<"countdown" | "dots" | "clear" | null>(null);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = readColorTokens(canvas, FLASH_COUNT_COLOR_TOKENS);
    // The countdown counts from `start`; the flash from the first frame that drew the dots.
    let start: number | null = null;
    let flashStart: number | null = null;

    const draw = (showDots: boolean) => {
      drawFlashCount(ctx, { dots: params.dots, showDots, ...fitCanvas(canvas), colors });
    };

    const tick = (now: number) => {
      // A hidden tab shows nothing, so the flash starts over in the first frame back (T110).
      if (document.hidden) {
        start = null;
        flashStart = null;
        return true;
      }
      start ??= now;
      const elapsed = now - start;
      if (elapsed < countdownMs) {
        draw(false);
        setShowing("countdown");
        setCountdownNumber(Math.ceil((countdownMs - elapsed) / COUNTDOWN_STEP_MS));
        return true;
      }
      setCountdownNumber(null);
      // From the first frame that shows the dots, so a slow frame at the switch takes no time off the flash.
      flashStart ??= now;
      const visible = dotsVisible(now - flashStart, params.flashMs);
      draw(visible);
      setShowing(visible ? "dots" : "clear");
      if (!visible) document.removeEventListener("visibilitychange", onVisibilityChange);
      return visible;
    };
    // Browsers usually run no frames while hidden, so the hide itself restarts the flash.
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      start = null;
      flashStart = null;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const stop = runFrames(tick);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [params, countdownMs]);

  // The answer field appears once the board clears; put the cursor in it.
  useEffect(() => {
    if (showing === "clear") inputRef.current?.focus();
  }, [showing]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = parseCount(String(new FormData(event.currentTarget).get("count") ?? ""));
    if (count === null) {
      setError(INVALID);
      return;
    }
    onFinish({ count });
  };

  return (
    <div className={styles.game}>
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.board}
          data-showing={showing ?? "waiting"}
          aria-label={showing === "countdown" ? "Get ready." : showing === "clear" ? "The dots are gone." : "Count the dots."}
          role="img"
        />
        {/* Keyed on the number, so each one plays its pop again. Hidden from screen readers:
            the board's label says "Get ready." */}
        {countdownNumber !== null && (
          <span key={countdownNumber} className={styles.countdown} data-countdown="" aria-hidden="true">
            {countdownNumber}
          </span>
        )}
      </div>
      {showing === "clear" && (
        <form className={styles.answer} onSubmit={submit} noValidate>
          <Field name="count" label="How many dots were there?" error={error}>
            {(control) => <TextInput {...control} ref={inputRef} inputMode="numeric" autoComplete="off" maxLength={3} />}
          </Field>
          <Button type="submit">Submit</Button>
        </form>
      )}
    </div>
  );
}

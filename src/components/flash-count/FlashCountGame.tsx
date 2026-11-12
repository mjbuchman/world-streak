"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { FlashCountInputs, FlashCountParams } from "@/challenges/flash-count/engine";
import { dotsVisible, drawFlashCount, type FlashCountFrame } from "@/challenges/flash-count/render";
import { Field, TextInput } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import styles from "./FlashCountGame.module.css";

const INVALID = "Enter a whole number from 0 to 999.";

/** Reads the Fresh Sport colour tokens, so the canvas matches the rest of the page. */
function themeColors(element: HTMLElement): FlashCountFrame["colors"] {
  const style = getComputedStyle(element);
  return {
    board: style.getPropertyValue("--fs-color-meter-surface").trim(),
    dot: style.getPropertyValue("--fs-color-mint").trim(),
  };
}

/** A typed answer as a count, or null unless it is a whole number from 0 to 999. */
function parseCount(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,3}$/.test(trimmed) ? Number(trimmed) : null;
}

type FlashCountGameProps = { params: FlashCountParams; onFinish: (inputs: FlashCountInputs) => void };

/**
 * A Swift Sum run: the dots appear in the first frame after the canvas is on screen, stay for
 * `flashMs` of elapsed time (whatever the frame rate), then the board clears and the player
 * enters how many there were. If the tab is hidden while the dots are shown, they are shown again
 * in full on return, so a scored player always gets the whole flash.
 */
export function FlashCountGame({ params, onFinish }: FlashCountGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showing, setShowing] = useState<"dots" | "clear" | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = themeColors(canvas);
    let start: number | null = null;
    let frame = 0;

    const draw = (showDots: boolean) => {
      const { width, height } = canvas.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;
      // Resizing clears and reallocates the backing store, so only do it when the size changes.
      const pixelWidth = Math.round(width * devicePixelRatio);
      const pixelHeight = Math.round(height * devicePixelRatio);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      drawFlashCount(ctx, { dots: params.dots, showDots, width, height, devicePixelRatio, colors });
    };

    const tick = () => {
      // A hidden tab shows nothing, so the flash starts over in the first frame back (T110).
      if (document.hidden) {
        start = null;
        frame = requestAnimationFrame(tick);
        return;
      }
      const now = performance.now();
      start ??= now;
      const visible = dotsVisible(now - start, params.flashMs);
      draw(visible);
      setShowing(visible ? "dots" : "clear");
      if (visible) frame = requestAnimationFrame(tick);
      else document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // Browsers usually run no frames while hidden, so the hide itself restarts the flash.
    const onVisibilityChange = () => {
      if (document.hidden) start = null;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [params]);

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
      <canvas
        ref={canvasRef}
        className={styles.board}
        data-showing={showing ?? "waiting"}
        aria-label={showing === "clear" ? "The dots are gone." : "Count the dots."}
        role="img"
      />
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

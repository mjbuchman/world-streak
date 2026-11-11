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
 * enters how many there were.
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
      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(height * devicePixelRatio);
      drawFlashCount(ctx, { dots: params.dots, showDots, width, height, devicePixelRatio, colors });
    };

    const tick = () => {
      const now = performance.now();
      start ??= now;
      const visible = dotsVisible(now - start, params.flashMs);
      draw(visible);
      setShowing(visible ? "dots" : "clear");
      if (visible) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
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

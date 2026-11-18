"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { LIVES, play, sequenceFor, type EchoPathInputs, type EchoPathParams } from "@/challenges/echo-path/engine";
import { boardLayout, clearedTrail, drawEchoPath, hitTile, litTileAt, missStrength, playbackMs, trailAt } from "@/challenges/echo-path/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { ECHO_PATH_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import styles from "./EchoPathGame.module.css";

/** The pause after a clear or a miss before the next playback starts. */
export const BETWEEN_MS = 700;
/** How long a pressed tile stays highlighted. */
export const PRESS_MS = 150;

type Phase = "countdown" | "watch" | "repeat" | "done";
type Showing = { startsAt: number; sequence: number[] };

/** Rows and columns each arrow key moves the keyboard's tile; up climbs the board (row 0 is the bottom). */
const ARROWS: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

type EchoPathGameProps = {
  params: EchoPathParams;
  onFinish: (inputs: EchoPathInputs) => void;
  /** How long the 3-2-1 lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * An Echo Path run: after the 3-2-1, the path's first tiles play back on the board (by elapsed
 * time), then the player taps them back. Taps during the playback are ignored. A clear shows the
 * cleared path briefly; a clear or a miss pauses for BETWEEN_MS, then the next playback starts
 * (one tile longer after a clear, the same after a miss). Taps are timed from the first frame.
 */
export function EchoPathGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: EchoPathGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const taps = useRef<EchoPathInputs["taps"]>([]);
  const showing = useRef<Showing | null>(null);
  const pressed = useRef<{ tile: number; at: number } | null>(null);
  const cleared = useRef<{ tiles: number[]; at: number } | null>(null);
  const missedAt = useRef<number | null>(null);
  // Null until the player first uses the arrow keys, so the ring never shows for touch players.
  const focus = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  });

  const [phase, setPhase] = useState<Phase>(countdownMs > 0 ? "countdown" : "watch");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [state, setState] = useState(() => play(params, { taps: [] }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = readColorTokens(canvas, ECHO_PATH_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const number = countdownNumber(now - startedAt.current, countdownMs);
      setCountdown(number);
      // The first playback starts right after "1".
      if (number === null) showing.current ??= { startsAt: now, sequence: sequenceFor(params, params.startLength) };
      const current = showing.current;
      const since = current ? now - current.startsAt : -1;
      const over = taps.current.length > 0 && play(params, { taps: taps.current }).finished;
      if (number !== null) setPhase("countdown");
      else if (!over) setPhase(current && since >= playbackMs(current.sequence.length, params.stepMs) ? "repeat" : "watch");
      const press = pressed.current && now - pressed.current.at < PRESS_MS ? pressed.current.tile : null;
      const sinceClear = cleared.current ? now - cleared.current.at : null;
      const trail = [
        ...(current ? trailAt(current.sequence, params.stepMs, since, reducedRef.current) : []),
        ...clearedTrail(cleared.current?.tiles ?? [], sinceClear, reducedRef.current),
      ];
      drawEchoPath(ctx, {
        cols: params.cols,
        rows: params.rows,
        ...fitCanvas(canvas),
        lit: current ? litTileAt(current.sequence, params.stepMs, since) : null,
        trail,
        pressed: press,
        focus: focus.current,
        miss: missStrength(missedAt.current === null ? null : now - missedAt.current, reducedRef.current),
        colors,
      });
      // Keep drawing until the last press, clear and miss have faded.
      const fading = press !== null || trail.length > 0 || missStrength(missedAt.current === null ? null : now - missedAt.current, false) > 0;
      return !over || fading;
    };
    return runFrames(tick);
  }, [params, countdownMs]);

  const tapTile = (tile: number) => {
    const current = showing.current;
    const now = performance.now();
    if (!current || startedAt.current === null) return;
    // During the playback, and the pause before it, taps do not count.
    if (now - current.startsAt < playbackMs(current.sequence.length, params.stepMs)) return;
    const before = play(params, { taps: taps.current });
    if (before.finished) return;
    taps.current = [...taps.current, { tile, atMs: now - startedAt.current }];
    const after = play(params, { taps: taps.current });
    pressed.current = { tile, at: now };
    setState(after);
    if (after.lives < before.lives) missedAt.current = now;
    if (after.longest > before.longest) cleared.current = { tiles: sequenceFor(params, after.longest), at: now };
    if (after.finished) {
      setPhase("done");
      finishRef.current({ taps: taps.current });
    } else if (after.position === 0) {
      showing.current = { startsAt: now + BETWEEN_MS, sequence: sequenceFor(params, after.length) };
      setPhase("watch");
    }
  };

  // The main button or a touch only: a right-click is not a tap.
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (event.button !== 0 || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tile = hitTile(boardLayout(rect.width, rect.height, params.cols, params.rows), event.clientX - rect.left, event.clientY - rect.top);
    if (tile !== null) tapTile(tile);
  };

  // A tall board has more tiles than number keys: the arrows move a ring, Space or Enter taps it.
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const arrow = ARROWS[event.key];
    const tapKey = event.key === " " || event.key === "Enter";
    if (!arrow && !tapKey) return;
    event.preventDefault();
    if (event.repeat && tapKey) return;
    // The first key only shows the ring, on the bottom row's middle tile.
    if (focus.current === null) {
      focus.current = Math.floor(params.cols / 2);
      return;
    }
    if (tapKey) {
      tapTile(focus.current);
      return;
    }
    const row = Math.min(params.rows - 1, Math.max(0, Math.floor(focus.current / params.cols) + arrow[0]));
    const col = Math.min(params.cols - 1, Math.max(0, (focus.current % params.cols) + arrow[1]));
    focus.current = row * params.cols + col;
  };

  const total = params.path.length;
  const label =
    phase === "countdown" ? "Get ready." : phase === "watch" ? "Watch the tiles light up." : phase === "repeat" ? "Tap the tiles in the same order." : "Done.";
  return (
    <div className={styles.game}>
      <div className={styles.status}>
        <span role="img" aria-label={`${state.lives} of ${LIVES} lives left`} className={styles.lives}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={styles.pip} data-lost={i >= state.lives || undefined} />
          ))}
        </span>
        {/* The path's length, one cell a tile, filled as far as it is cleared; the last cell is the top. */}
        <span role="img" aria-label={`Tile ${Math.min(state.length, total)} of ${total}`} className={styles.pathBar}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={styles.cell} data-cleared={i < state.longest || undefined} />
          ))}
        </span>
      </div>
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.board}
          data-phase={phase}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />
        {countdown !== null && <CountdownNumber key={countdown} value={countdown} />}
      </div>
      <p className={styles.hint}>Tap the tiles, or move with the arrow keys and press Space or Enter.</p>
    </div>
  );
}

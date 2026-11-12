// The animation-frame loop shared by the challenge components (T137). Each game keeps its own
// start time: the Tower times taps from mount, Second Sense from its first frame, and Swift Sum
// starts over after a hidden tab.

/**
 * Runs `step` once per animation frame, from the next frame on, with that frame's
 * `performance.now()`, until it returns false. Returns the cancel for the effect's cleanup.
 */
export function runFrames(step: (now: number) => boolean): () => void {
  let id = 0;
  const frame = () => {
    if (step(performance.now())) id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(id);
}

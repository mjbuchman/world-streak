// Shared canvas plumbing for the challenge components (T135).

/**
 * Sizes the canvas's backing store to its CSS box times the device pixel ratio, so drawing is
 * sharp. Resizing clears and reallocates the store, so it only happens when the size changes.
 */
export function fitCanvas(canvas: HTMLCanvasElement): { width: number; height: number; devicePixelRatio: number } {
  const { width, height } = canvas.getBoundingClientRect();
  const devicePixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * devicePixelRatio);
  const pixelHeight = Math.round(height * devicePixelRatio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  return { width, height, devicePixelRatio };
}

/** Reads CSS custom properties off an element, so the canvas matches the rest of the page. */
export function readColorTokens<K extends string>(element: HTMLElement, tokens: Record<K, string>): Record<K, string> {
  const style = getComputedStyle(element);
  const entries = Object.entries<string>(tokens).map(([key, token]) => [key, style.getPropertyValue(token).trim()]);
  return Object.fromEntries(entries) as Record<K, string>;
}

// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { HydrationMarker } from "./HydrationMarker";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.hydrated;
});

describe("HydrationMarker", () => {
  it("marks the page once it runs in the browser, rendering nothing", () => {
    expect(document.documentElement.hasAttribute("data-hydrated")).toBe(false);
    const { container } = render(<HydrationMarker />);
    expect(document.documentElement.hasAttribute("data-hydrated")).toBe(true);
    expect(container.innerHTML).toBe("");
  });

  it("does not mark anything during the server render", () => {
    expect(renderToString(<HydrationMarker />)).toBe("");
    expect(document.documentElement.hasAttribute("data-hydrated")).toBe(false);
  });
});

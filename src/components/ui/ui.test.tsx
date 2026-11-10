// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "./BackButton";
import { Button } from "./Button";
import { Confetti } from "./Confetti";
import { LinkButton } from "./LinkButton";
import { PageShell } from "./PageShell";
import { ResultHero } from "./ResultHero";
import { Spinner } from "./Spinner";
import { Surface } from "./Surface";
import { usePrefersReducedMotion } from "./useReducedMotion";

/** Makes `matchMedia("(prefers-reduced-motion: reduce)")` answer `reduced`. */
function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Button", () => {
  it("is a real button, primary by default, and passes clicks and attributes through", async () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" onClick={onClick}>
        Start
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Start" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.className).toMatch(/primary/);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("offers a secondary look", () => {
    render(<Button variant="secondary">Back to home</Button>);
    expect(screen.getByRole("button", { name: "Back to home" }).className).toMatch(/secondary/);
  });

  it("while loading: keeps its label (and width), shows a spinner, is busy and cannot be pressed", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Create account
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Create account/ });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.querySelector("[data-spinner]")).not.toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps keyboard focus while it turns busy, and does not submit its form", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Save</Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    rerender(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Save
        </Button>
      </form>,
    );
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("defaults to type button, so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("can still be plainly disabled", () => {
    render(<Button disabled>Start</Button>);
    expect(screen.getByRole("button", { name: "Start" })).toHaveProperty("disabled", true);
  });

  it("spins its loading ring, or holds it still when the player prefers reduced motion", () => {
    stubReducedMotion(false);
    const { unmount } = render(<Button loading>Save</Button>);
    expect(screen.getByRole("button").querySelector("[data-spinner]")!.getAttribute("data-motion")).toBe("spin");
    unmount();

    stubReducedMotion(true);
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button").querySelector("[data-spinner]")!.getAttribute("data-motion")).toBe("still");
  });

  it("is not busy and has no spinner when not loading", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.querySelector("[data-spinner]")).toBeNull();
  });
});

describe("LinkButton", () => {
  it("is a link that looks like a button", () => {
    render(
      <LinkButton href="/play" variant="secondary">
        Play today&apos;s challenge
      </LinkButton>,
    );
    const link = screen.getByRole("link", { name: "Play today's challenge" });
    expect(link.getAttribute("href")).toBe("/play");
    expect(link.className).toMatch(/secondary/);
  });

  it("is primary by default", () => {
    render(<LinkButton href="/play">Play</LinkButton>);
    expect(screen.getByRole("link", { name: "Play" }).className).toMatch(/primary/);
  });
});

describe("BackButton", () => {
  it("is a labelled link, home by default", () => {
    render(<BackButton />);
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
  });

  it("goes where it is told", () => {
    render(<BackButton href="/practice/stacking" />);
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/practice/stacking");
  });
});

describe("Spinner", () => {
  it("announces what is loading to screen readers", () => {
    stubReducedMotion(false);
    render(<Spinner label="Checking your result" />);
    expect(screen.getByRole("status").textContent).toBe("Checking your result");
  });

  it("spins normally, and holds still when the player prefers reduced motion", () => {
    stubReducedMotion(false);
    const { unmount } = render(<Spinner />);
    expect(screen.getByRole("status").querySelector("[data-spinner]")!.getAttribute("data-motion")).toBe("spin");
    unmount();

    stubReducedMotion(true);
    render(<Spinner />);
    expect(screen.getByRole("status").querySelector("[data-spinner]")!.getAttribute("data-motion")).toBe("still");
    expect(screen.getByRole("status").textContent).toBe("Loading");
  });
});

describe("Spinner with a visible label", () => {
  it("shows the label next to the ring, announced once", () => {
    stubReducedMotion(false);
    render(<Spinner label="Checking your result" visibleLabel />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Checking your result");
    expect(status.querySelector(".visually-hidden")).toBeNull();
  });
});

describe("Confetti", () => {
  it("drops a burst of falling blocks, hidden from screen readers", () => {
    stubReducedMotion(false);
    const { container } = render(<Confetti />);
    const burst = container.firstElementChild!;
    expect(burst.getAttribute("aria-hidden")).toBe("true");
    expect(burst.children.length).toBeGreaterThanOrEqual(10);
  });

  it("draws nothing when the player prefers reduced motion", () => {
    stubReducedMotion(true);
    const { container } = render(<Confetti />);
    expect(container.firstElementChild).toBeNull();
  });
});

describe("ResultHero", () => {
  it("shows the big score first (for the eye only), then the heading, the text and the actions", () => {
    stubReducedMotion(false);
    const { container } = render(
      <ResultHero score={7} heading="You reached row 7" actions={<LinkButton href="/">Back to home</LinkButton>}>
        <p>Practice never counts.</p>
      </ResultHero>,
    );
    const score = container.querySelector("[data-big-score]")!;
    expect(score.textContent).toBe("7");
    expect(score.getAttribute("aria-hidden")).toBe("true");
    const heading = screen.getByRole("heading", { level: 2, name: "You reached row 7" });
    // The human's choice (second play-test): the score above the heading.
    expect(score.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("Practice never counts.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" })).toBeTruthy();
    expect(container.querySelector("[data-confetti]")).toBeNull();
  });

  it("forwards a ref to the heading, so the page can move focus to it when a run ends", () => {
    const ref = { current: null as HTMLHeadingElement | null };
    render(<ResultHero heading="Passed" headingRef={ref} actions={null} />);
    expect(ref.current).toBe(screen.getByRole("heading", { name: "Passed" }));
  });

  it("can leave the score out (a refused submission has none)", () => {
    const { container } = render(<ResultHero heading="Counted as not passed" actions={null} />);
    expect(container.querySelector("[data-big-score]")).toBeNull();
  });

  it("can celebrate with confetti", () => {
    stubReducedMotion(false);
    const { container } = render(<ResultHero score={12} heading="Passed" confetti actions={null} />);
    expect(container.querySelector("[data-confetti]")).not.toBeNull();
  });

  it.each([
    // tone, mint, glow
    [undefined, false, false], // the default is plain: celebration is opt-in
    ["plain", false, false],
    ["practice", true, false],
    ["pass", true, true],
  ] as const)("styles the score and heading for tone %s (mint %s, glow %s)", (tone, mint, glow) => {
    const { container } = render(<ResultHero score={7} heading="Result" tone={tone} actions={null} />);
    for (const element of [container.querySelector("[data-big-score]")!, screen.getByRole("heading", { name: "Result" })]) {
      expect(/resultMint/.test(element.className)).toBe(mint);
      expect(/resultGlow/.test(element.className)).toBe(glow);
    }
  });
});

describe("usePrefersReducedMotion", () => {
  function Probe() {
    return <span>{usePrefersReducedMotion() ? "reduced" : "full"}</span>;
  }

  it("follows the media query, and assumes full motion where it cannot ask", () => {
    stubReducedMotion(true);
    const { unmount } = render(<Probe />);
    expect(screen.getByText("reduced")).toBeTruthy();
    unmount();

    vi.stubGlobal("matchMedia", undefined);
    render(<Probe />);
    expect(screen.getByText("full")).toBeTruthy();
  });

  it("updates when the setting changes, and stops listening on unmount", () => {
    let matches = false;
    let listener: (() => void) | undefined;
    const removeEventListener = vi.fn();
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener,
    }));
    const { unmount } = render(<Probe />);
    expect(screen.getByText("full")).toBeTruthy();
    matches = true;
    act(() => listener!());
    expect(screen.getByText("reduced")).toBeTruthy();
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });

  it("renders full motion on the server, so hydration never mismatches", async () => {
    stubReducedMotion(true);
    const { renderToString } = await import("react-dom/server");
    expect(renderToString(<Probe />)).toContain("full");
  });
});

describe("Surface", () => {
  it("wraps its content, as a div or a section", () => {
    const { container, unmount } = render(<Surface>Inside</Surface>);
    expect(container.firstElementChild!.tagName).toBe("DIV");
    expect(screen.getByText("Inside")).toBeTruthy();
    unmount();
    render(
      <Surface as="section" aria-label="Today's challenge">
        Card
      </Surface>,
    );
    expect(screen.getByRole("region", { name: "Today's challenge" })).toBeTruthy();
  });

  it("has a highlighted tone for the featured item", () => {
    const { container } = render(<Surface tone="highlight">Featured</Surface>);
    expect(container.firstElementChild!.className).toMatch(/highlight/);
    cleanup();
    const plain = render(<Surface>Plain</Surface>);
    expect(plain.container.firstElementChild!.className).not.toMatch(/highlight/);
  });
});

describe("PageShell", () => {
  it("is the page's main landmark, with an optional title and back button", () => {
    const { unmount } = render(
      <PageShell title="Practice" backHref="/">
        <p>Body</p>
      </PageShell>,
    );
    const main = screen.getByRole("main");
    expect(main.querySelector("h1")!.textContent).toBe("Practice");
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Body")).toBeTruthy();
    unmount();

    render(<PageShell>Home</PageShell>);
    expect(screen.getByRole("main").querySelector("h1")).toBeNull();
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
  });
});

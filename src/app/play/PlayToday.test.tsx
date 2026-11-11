// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paramsFromSeed, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";
import { STACKING_HOW_TO } from "@/config/challenges";

type GameProps = {
  params: StackingParams;
  onFinish: (run: { taps: number[]; result: StackingResult }) => void;
  passTarget?: number;
};
const games = vi.hoisted(() => [] as GameProps[]);
vi.mock("@/components/stacking/StackingGame", () => ({
  StackingGame: (props: GameProps) => {
    games.push(props);
    // Like the real game, it takes focus when it mounts.
    return <div data-testid="game" tabIndex={-1} ref={(element) => element?.focus()} />;
  },
}));
// The meter polls on its own (Meter.test.tsx); here it must not take the start and submit replies.
vi.mock("@/components/Meter", () => ({ Meter: () => <section data-testid="meter" /> }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { PlayToday } from "./PlayToday";

const attemptId = "0b6d1d6c-6c1e-4b8e-9a4a-5f3c2d1e0a9b";
const params = paramsFromSeed(77);
const started = { attemptId, gameDate: "2026-11-08", challengeType: "stacking", seed: 77, params, passTarget: 12 };

let fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** Queues responses for the start and submit calls, in order. */
function respond(...responses: (Response | Error)[]) {
  for (const response of responses) {
    if (response instanceof Error) fetchSpy.mockRejectedValueOnce(response);
    else fetchSpy.mockResolvedValueOnce(response);
  }
}

beforeEach(() => {
  fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  games.length = 0;
  refresh.mockReset();
  vi.unstubAllGlobals();
});

// onFinish starts the (async) submission; the test then waits for what it renders.
const finish = (taps: number[], score: number) =>
  act(async () => {
    games.at(-1)!.onFinish({ taps, result: { score, rows: [], endedAtMs: 1000, endReason: "miss", moving: null } });
  });

async function startRun() {
  render(<PlayToday initial={{ kind: "ready" }} />);
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  await screen.findByTestId("game");
}

describe("PlayToday", () => {
  it("shows how to play and offers practice first, before the one scored attempt", () => {
    render(<PlayToday initial={{ kind: "ready" }} />);
    const howTo = screen.getByText(STACKING_HOW_TO);
    const rule = screen.getByText(/one scored attempt/i);
    // The controls come before the rule, so nobody spends the attempt without seeing them.
    expect(howTo.compareDocumentPosition(rule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/stacking");
  });

  it("shows the how-to only before Start", async () => {
    for (const initial of [{ kind: "submitted", score: 11, passed: true, passTarget: 10 }, { kind: "abandoned" }] as const) {
      render(<PlayToday initial={initial} />);
      expect(screen.queryByText(STACKING_HOW_TO)).toBeNull();
      cleanup();
    }
    respond(json(200, started));
    await startRun();
    expect(screen.queryByText(STACKING_HOW_TO)).toBeNull();
    expect(screen.queryByRole("link", { name: "Practice first" })).toBeNull();
  });

  it("hides Practice first while Start is busy, as leaving then would lose the attempt", async () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => undefined));
    render(<PlayToday initial={{ kind: "ready" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.queryByRole("link", { name: "Practice first" })).toBeNull();
  });

  it("words a score of 0 (attempts stored before T87) and a fractional target in rows", () => {
    render(<PlayToday initial={{ kind: "submitted", score: 0, passed: false, passTarget: 10.2 }} />);
    expect(screen.getByText("You didn't stack a row. Today's target was row 11.")).toBeTruthy();
  });

  it("makes a pass glow mint, and leaves a fail or a refused submission plain", async () => {
    render(<PlayToday initial={{ kind: "submitted", score: 11, passed: true, passTarget: 10 }} />);
    const passed = screen.getByRole("heading", { name: "Passed" });
    expect(passed.className).toMatch(/resultMint/);
    expect(passed.className).toMatch(/resultGlow/);
    cleanup();

    render(<PlayToday initial={{ kind: "submitted", score: 3, passed: false, passTarget: 10 }} />);
    expect(screen.getByRole("heading", { name: "Not this time" }).className).not.toMatch(/resultMint|resultGlow/);
    cleanup();

    respond(json(200, started), json(409, { error: "day-closed" }));
    await startRun();
    await finish([900], 1);
    expect((await screen.findByRole("heading", { name: "Counted as not passed" })).className).not.toMatch(/resultMint|resultGlow/);
  });

  it("shows the live meter below the result, and not before or during the run", async () => {
    render(<PlayToday initial={{ kind: "submitted", score: 11, passed: true, passTarget: 10 }} />);
    const verdict = screen.getByRole("heading", { name: "Passed" });
    const meter = screen.getByTestId("meter");
    expect(verdict.compareDocumentPosition(meter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();

    respond(json(200, started));
    await startRun();
    expect(screen.queryByTestId("meter")).toBeNull();
  });

  it("shows the score as the result's big number, above the verdict as in practice", () => {
    const { container } = render(<PlayToday initial={{ kind: "submitted", score: 11, passed: true, passTarget: 10 }} />);
    const score = container.querySelector("[data-big-score]")!;
    expect(score.textContent).toBe("11");
    const verdict = screen.getByRole("heading", { name: "Passed" });
    expect(score.compareDocumentPosition(verdict) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explains the one-attempt rule, including leaving early, before Start", () => {
    render(<PlayToday initial={{ kind: "ready" }} />);
    expect(screen.getByText(/one scored attempt/i)).toBeTruthy();
    expect(screen.getByText(/leave before you finish, it counts as not\s+passed/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("starts the attempt on the server and plays the instance it issued", async () => {
    respond(json(200, started));
    await startRun();
    expect(fetchSpy).toHaveBeenCalledWith("/api/attempts/start", { method: "POST" });
    expect(games.at(-1)!.params).toEqual(params);
    // Today's target from the server, for the HUD and the target line.
    expect(games.at(-1)!.passTarget).toBe(12);
  });

  it("submits only the taps, then shows the server's verdict with the score and target", async () => {
    respond(json(200, started), json(200, { score: 12, passed: true, passTarget: 10 }));
    await startRun();
    await finish([900, 1700], 2);

    const heading = await screen.findByRole("heading", { name: "Passed" });
    const [, request] = fetchSpy.mock.calls[1];
    expect(fetchSpy.mock.calls[1][0]).toBe("/api/attempts/submit");
    expect(request).toMatchObject({ method: "POST", headers: { "content-type": "application/json" } });
    expect(JSON.parse(request!.body as string)).toEqual({ attemptId, inputs: { tapsMs: [900, 1700] } });
    // The server's score is shown, not the client's own count.
    expect(screen.getByText("You reached row 12. Today's target was row 10.")).toBeTruthy();
    // Focus moves to the result, as in practice (T60).
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("says Not this time for a fail", async () => {
    respond(json(200, started), json(200, { score: 1, passed: false, passTarget: 10 }));
    await startRun();
    await finish([900], 1);
    expect(await screen.findByRole("heading", { name: "Not this time" })).toBeTruthy();
    expect(screen.getByText("You reached row 1. Today's target was row 10.")).toBeTruthy();
  });

  it("shows that the result is being checked while the submission is in flight", async () => {
    let answer!: (response: Response) => void;
    respond(json(200, started));
    fetchSpy.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    await startRun();
    await finish([900], 1);
    expect(await screen.findByText("Checking your result")).toBeTruthy();
    await act(async () => answer(json(200, { score: 1, passed: false, passTarget: 10 })));
    expect(await screen.findByRole("heading", { name: "Not this time" })).toBeTruthy();
  });

  it("shows today's result, with no Start, once the attempt was submitted", () => {
    render(<PlayToday initial={{ kind: "submitted", score: 11, passed: true, passTarget: 10 }} />);
    expect(screen.getByRole("heading", { name: "Passed" })).toBeTruthy();
    expect(screen.getByText("You reached row 11. Today's target was row 10.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("explains an abandoned attempt, with no Start", () => {
    render(<PlayToday initial={{ kind: "abandoned" }} />);
    expect(
      screen.getByText("You left today's attempt before finishing, so it counted as not passed. Come back tomorrow."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("reloads the page's state if the attempt was already submitted elsewhere", async () => {
    respond(json(409, { error: "already-started", submitted: true }));
    render(<PlayToday initial={{ kind: "ready" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows the abandoned message if an unfinished attempt already exists", async () => {
    respond(json(409, { error: "already-started", submitted: false }));
    render(<PlayToday initial={{ kind: "ready" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText(/You left today's attempt before finishing/)).toBeTruthy();
  });

  it("lets the player try Start again if starting failed", async () => {
    for (const failure of [json(500, { error: "server-error" }), new Error("offline")]) {
      respond(failure);
      render(<PlayToday initial={{ kind: "ready" }} />);
      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      expect((await screen.findByRole("alert")).textContent).toBe("Today's attempt could not be started. Please try again.");
      expect(screen.getByRole("button", { name: "Start" })).toHaveProperty("disabled", false);
      expect(games).toHaveLength(0);
      cleanup();
    }
  });

  it("says what to do when the session has ended or the account is not set up", async () => {
    const cases: [number, string][] = [
      [401, "Your session has ended. Sign in again to play."],
      [403, "Finish setting up your account to play."],
    ];
    for (const [status, message] of cases) {
      respond(json(status, { error: "x" }));
      render(<PlayToday initial={{ kind: "ready" }} />);
      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      expect((await screen.findByRole("alert")).textContent).toBe(message);
      cleanup();
    }
  });

  it("shows Start as busy while the request is in flight, so it cannot be sent twice", async () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => undefined));
    render(<PlayToday initial={{ kind: "ready" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const busy = screen.getByRole("button", { name: "Start" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(busy);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("celebrates a pass that just arrived with confetti, but not a fail", async () => {
    respond(json(200, started), json(200, { score: 12, passed: true, passTarget: 10 }));
    await startRun();
    await finish([900, 1700], 2);
    await screen.findByRole("heading", { name: "Passed" });
    expect(document.querySelector("[data-confetti]")).not.toBeNull();
    expect(screen.getByText(/You helped keep the streak alive/)).toBeTruthy();
    cleanup();

    respond(json(200, started), json(200, { score: 1, passed: false, passTarget: 10 }));
    await startRun();
    await finish([900], 1);
    await screen.findByRole("heading", { name: "Not this time" });
    expect(document.querySelector("[data-confetti]")).toBeNull();
    expect(screen.queryByText(/You helped keep the streak alive/)).toBeNull();
  });

  it("does not replay the confetti when today's pass is shown on a later visit", () => {
    const { container } = render(<PlayToday initial={{ kind: "submitted", score: 11, passed: true, passTarget: 10 }} />);
    expect(screen.getByRole("heading", { name: "Passed" })).toBeTruthy();
    expect(container.querySelector("[data-confetti]")).toBeNull();
  });

  it("offers a way back home from every finished state", () => {
    for (const initial of [
      { kind: "submitted", score: 11, passed: true, passTarget: 10 },
      { kind: "abandoned" },
    ] as const) {
      render(<PlayToday initial={initial} />);
      expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
      cleanup();
    }
  });

  it("shows the stored result if this attempt was already submitted (for example from another tab)", async () => {
    respond(json(200, started), json(409, { error: "already-submitted" }));
    await startRun();
    await finish([900], 1);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("explains a submission the server refused or could not receive", async () => {
    // A refused result still counts as an attempt that did not pass (started attempts count, T17);
    // one that never arrived may or may not have been recorded.
    const refused = "Counted as not passed";
    const notSent = "Result not sent";
    const cases: [Response | Error, string, string][] = [
      [json(409, { error: "day-closed" }), refused, "Today's challenge closed before your result arrived, so it counted as not passed."],
      [json(422, { error: "implausible-timing" }), refused, "Your result could not be checked, so it counted as not passed."],
      [json(500, { error: "server-error" }), notSent, "Your result could not be sent. Reload the page to see whether it counted."],
      [json(422, { error: "something-new" }), notSent, "Your result could not be sent. Reload the page to see whether it counted."],
      [new Error("offline"), notSent, "Your result could not be sent. Reload the page to see whether it counted."],
    ];
    for (const [failure, heading, message] of cases) {
      respond(json(200, started), failure);
      await startRun();
      await finish([900], 1);
      expect((await screen.findByRole("alert")).textContent).toBe(message);
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: heading }));
      expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
      // A way back home here too, like every other finished state.
      expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
      cleanup();
      games.length = 0;
    }
  });
});

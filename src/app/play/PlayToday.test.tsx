// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paramsFromSeed, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";
import { FLASH_COUNT_HOW_TO, INNER_CLOCK_HOW_TO, STACKING_HOW_TO } from "@/config/challenges";
import type { GameStatus, TodaysDay } from "@/lib/attempts/today";

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
// Another challenge's game: a stand-in that answers with fixed inputs.
vi.mock("@/components/flash-count/FlashCountGame", () => ({
  FlashCountGame: ({ onFinish }: { onFinish: (inputs: { answers: { count: number; atMs: number }[] }) => void }) => (
    <button type="button" onClick={() => onFinish({ answers: [{ count: 20, atMs: 4000 }] })}>
      Answer 20
    </button>
  ),
}));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { PlayToday } from "./PlayToday";

const attemptId = "0b6d1d6c-6c1e-4b8e-9a4a-5f3c2d1e0a9b";
const params = paramsFromSeed(77);
const started = { attemptId, gameDate: "2026-11-08", position: 1, challengeType: "stacking", seed: 77, params, passTarget: 12 };

const lineup = [
  { position: 1, challengeType: "stacking", passTarget: 12 },
  { position: 2, challengeType: "flash-count", passTarget: 5 },
  { position: 3, challengeType: "inner-clock", passTarget: 4 },
];
/** A day with these statuses for games 1 to 3 (scored games get `score`). */
function dayOf(statuses: GameStatus["status"][], rest: Partial<TodaysDay> = {}): TodaysDay {
  const gamesNow = lineup.map((game, i): GameStatus => {
    const status = statuses[i] ?? "not-started";
    return status === "won" || status === "lost" ? { ...game, status, score: 9 } : { ...game, status };
  });
  const startedCount = statuses.filter((status) => status !== "not-started").length;
  return {
    gameDate: "2026-11-08",
    games: gamesNow,
    wins: statuses.filter((status) => status === "won").length,
    losses: statuses.filter((status) => status === "lost" || status === "in-progress").length,
    outcome: null,
    nextPosition: startedCount < 3 ? startedCount + 1 : null,
    ...rest,
  };
}
const fresh = dayOf([]);
const noDayYet: TodaysDay = { gameDate: "2026-11-08", games: [], wins: 0, losses: 0, outcome: null, nextPosition: 1 };
const progress = (wins: number, losses: number, outcome: TodaysDay["outcome"], nextPosition: number | null) => ({
  wins,
  losses,
  outcome,
  nextPosition,
});

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

const page = (initial: TodaysDay) => <PlayToday firstGame="stacking" initial={initial} />;

// onFinish starts the (async) submission; the test then waits for what it renders.
const finish = (taps: number[], score: number) =>
  act(async () => {
    games.at(-1)!.onFinish({ taps, result: { score, rows: [], endedAtMs: 1000, endReason: "miss", moving: null } });
  });

async function startRun(initial: TodaysDay = fresh) {
  const view = render(page(initial));
  await userEvent.click(screen.getByRole("button", { name: /^(Start|Play it anyway)$/ }));
  await screen.findByTestId("game");
  return view;
}

const list = () => within(screen.getByRole("list", { name: "Today's games" })).getAllByRole("listitem").map((item) => item.textContent);

describe("PlayToday before a game", () => {
  it("lists today's three games in order with each one's status, then offers the next game", () => {
    render(page(dayOf(["won", "lost"])));
    expect(list()).toEqual(["Game 1: Teetering TowerWon", "Game 2: Swift SumLost", "Game 3: Second SenseNot played"]);
    expect(screen.getByText("The day so far: 1 win, 1 loss.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Game 3 of 3: Second Sense" })).toBeTruthy();
    expect(screen.getByText(INNER_CLOCK_HOW_TO)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/inner-clock");
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("shows how to play and the rule (win two, leaving loses the game) before Start", () => {
    render(page(fresh));
    const howTo = screen.getByText(STACKING_HOW_TO);
    const rule = screen.getByText(/Win two of the three games to pass the day/);
    expect(rule.textContent).toMatch(/if you\s+leave before you finish, it counts as lost/);
    // The controls come before the rule, so nobody spends a game without seeing them.
    expect(howTo.compareDocumentPosition(rule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/stacking");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("offers the lineup's first game before the day exists, with no list yet", () => {
    render(<PlayToday firstGame="flash-count" initial={noDayYet} />);
    expect(screen.queryByRole("list", { name: "Today's games" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Game 1 of 3: Swift Sum" })).toBeTruthy();
    expect(screen.getByText(FLASH_COUNT_HOW_TO)).toBeTruthy();
  });

  it("shows a game started and left as lost, with the unfinished wording, and offers the next one", () => {
    render(page(dayOf(["won", "in-progress"])));
    expect(list()[1]).toBe("Game 2: Swift SumLost");
    expect(
      screen.getByText(
        "You started game 2 but haven't finished it here. If it's still open in another tab, finish it there before the day ends. Otherwise it counts as lost.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Game 3 of 3: Second Sense" })).toBeTruthy();
  });

  it.each([
    ["passed", ["won", "won"], "You passed today: two wins"],
    ["failed", ["lost", "in-progress"], "Not today: two losses"],
  ] as const)("says a %s day is decided and offers the remaining game, which cannot change it", (outcome, statuses, verdict) => {
    render(page(dayOf([...statuses], { outcome })));
    expect(screen.getByRole("heading", { name: verdict })).toBeTruthy();
    expect(screen.getByText(/won't change the result/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play it anyway" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.getByRole("link", { name: "See results" }).getAttribute("href")).toBe("/play/results");
  });

  it("offers only the results once all three games are played", () => {
    render(page(dayOf(["won", "lost", "won"], { outcome: "passed" })));
    expect(screen.getByRole("heading", { name: "You passed today: two wins" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/won't change the result/)).toBeNull();
    expect(screen.getByRole("link", { name: "See results" }).getAttribute("href")).toBe("/play/results");
  });

  it("says nothing is decided while the day is open", () => {
    render(page(dayOf(["won"])));
    expect(screen.queryByRole("link", { name: "See results" })).toBeNull();
    expect(screen.queryByText(/won't change the result/)).toBeNull();
  });
});

describe("PlayToday starting a game", () => {
  it("starts the next game on the server and plays the instance it issued", async () => {
    respond(json(200, started));
    await startRun();
    expect(fetchSpy).toHaveBeenCalledWith("/api/attempts/start", { method: "POST" });
    expect(games.at(-1)!.params).toEqual(params);
    // Today's target from the server, for the HUD and the target line.
    expect(games.at(-1)!.passTarget).toBe(12);
    expect(screen.queryByText(STACKING_HOW_TO)).toBeNull();
    expect(screen.queryByRole("link", { name: "Practice first" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Today's games" })).toBeNull();
  });

  it("shows Start as busy and hides Practice first while the request is in flight", async () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => undefined));
    render(page(fresh));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const busy = screen.getByRole("button", { name: "Start" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    // Leaving now would lose the game the server is creating.
    expect(screen.queryByRole("link", { name: "Practice first" })).toBeNull();
    await userEvent.click(busy);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("lets the player try again if starting failed", async () => {
    for (const failure of [json(500, { error: "server-error" }), new Error("offline")]) {
      respond(failure);
      render(page(fresh));
      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      expect((await screen.findByRole("alert")).textContent).toBe("The game could not be started. Please try again.");
      expect(screen.getByRole("button", { name: "Start" })).toHaveProperty("disabled", false);
      expect(games).toHaveLength(0);
      cleanup();
    }
  });

  it("says what to do when the session has ended", async () => {
    respond(json(401, { error: "x" }));
    render(page(fresh));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Your session has ended. Sign in again to play.");
  });

  it("refuses to play a challenge this build does not know", async () => {
    respond(json(200, { ...started, challengeType: "chess" }));
    render(page(fresh));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The game could not be started. Please try again.");
  });

  it("plays the challenge the server started, which may differ from the page's (the day rolled over)", async () => {
    const flashParams = { layoutSeed: 1, levels: [{ dotCount: 25, flashMs: 1000 }] };
    respond(
      json(200, { ...started, position: 2, challengeType: "flash-count", params: flashParams, passTarget: 5 }),
      json(200, { score: 2, passed: false, passTarget: 5, day: progress(1, 1, null, 3) }),
    );
    const user = userEvent.setup();
    render(page(dayOf(["won"])));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(await screen.findByRole("button", { name: "Answer 20" }));
    expect(await screen.findByRole("heading", { name: "Game 2 of 3: lost" })).toBeTruthy();
    expect(JSON.parse(fetchSpy.mock.calls[1][1]!.body as string)).toEqual({ attemptId, inputs: { answers: [{ count: 20, atMs: 4000 }] } });
    expect(screen.getByText("You scored 2 rounds. Today's target was 5 rounds: survive all five.")).toBeTruthy();
  });
});

describe("PlayToday after a game", () => {
  it("submits only the inputs, then shows Game N of 3 with the server's verdict and the day so far", async () => {
    respond(json(200, started), json(200, { score: 3, passed: false, passTarget: 12, day: progress(0, 1, null, 2) }));
    await startRun();
    await finish([900, 1700], 2);

    const heading = await screen.findByRole("heading", { name: "Game 1 of 3: lost" });
    expect(fetchSpy.mock.calls[1][0]).toBe("/api/attempts/submit");
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ method: "POST", headers: { "content-type": "application/json" } });
    expect(JSON.parse(fetchSpy.mock.calls[1][1]!.body as string)).toEqual({ attemptId, inputs: { tapsMs: [900, 1700] } });
    // The server's score is shown, not the client's own count.
    expect(screen.getByText("You reached row 3. Today's target was row 12.")).toBeTruthy();
    expect(document.querySelector("[data-big-score]")?.textContent).toBe("3");
    expect(screen.getByText("The day so far: 0 wins, 1 loss.")).toBeTruthy();
    // Focus moves to the result, as in practice (T60).
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector("[data-confetti]")).toBeNull();
  });

  it("shows that the result is being checked while the submission is in flight", async () => {
    let answer!: (response: Response) => void;
    respond(json(200, started));
    fetchSpy.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    await startRun();
    await finish([900], 1);
    expect(await screen.findByText("Checking your result")).toBeTruthy();
    await act(async () => answer(json(200, { score: 1, passed: false, passTarget: 12, day: progress(0, 1, null, 2) })));
    expect(await screen.findByRole("heading", { name: "Game 1 of 3: lost" })).toBeTruthy();
  });

  it("continues by reloading the day from the server, then offers the next game", async () => {
    respond(json(200, started), json(200, { score: 13, passed: true, passTarget: 12, day: progress(1, 0, null, 2) }));
    const { rerender } = await startRun();
    await finish([900], 13);
    const won = await screen.findByRole("heading", { name: "Game 1 of 3: won" });
    expect(won.closest("section")?.dataset.tone).toBe("pass");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(refresh).toHaveBeenCalled();
    rerender(page(dayOf(["won"])));
    expect(screen.getByRole("heading", { name: "Game 2 of 3: Swift Sum" })).toBeTruthy();
    expect(list()[0]).toBe("Game 1: Teetering TowerWon");
  });

  it("celebrates the win that passes the day, saying so, but not a win after it", async () => {
    respond(json(200, { ...started, position: 2 }), json(200, { score: 13, passed: true, passTarget: 12, day: progress(2, 0, "passed", 3) }));
    await startRun(dayOf(["won"]));
    await finish([900], 13);
    await screen.findByRole("heading", { name: "Game 2 of 3: won" });
    expect(screen.getByText("You passed today: two wins")).toBeTruthy();
    expect(document.querySelector("[data-confetti]")).not.toBeNull();
    // The remaining game is still offered.
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    cleanup();

    respond(json(200, { ...started, position: 3 }), json(200, { score: 13, passed: true, passTarget: 12, day: progress(3, 0, "passed", null) }));
    await startRun(dayOf(["won", "won"], { outcome: "passed" }));
    await finish([900], 13);
    await screen.findByRole("heading", { name: "Game 3 of 3: won" });
    expect(document.querySelector("[data-confetti]")).toBeNull();
    expect(screen.queryByText("You passed today: two wins")).toBeNull();
  });

  it("says when a loss decides the day, counting a game left earlier, and ends on See results after game 3", async () => {
    respond(json(200, { ...started, position: 3 }), json(200, { score: 1, passed: false, passTarget: 12, day: progress(1, 2, "failed", null) }));
    await startRun(dayOf(["won", "in-progress"]));
    await finish([900], 1);
    await screen.findByRole("heading", { name: "Game 3 of 3: lost" });
    expect(screen.getByText("Not today: two losses")).toBeTruthy();
    expect(screen.getByText("The day so far: 1 win, 2 losses.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.getByRole("link", { name: "See results" }).getAttribute("href")).toBe("/play/results");
  });

  it("explains a submission the server refused or could not receive, and continues from the server's day", async () => {
    const refused = "Counted as lost";
    const notSent = "Result not sent";
    const unsent = "Your result could not be sent. Continue to see whether it counted.";
    const cases: [Response | Error, string, string][] = [
      [json(409, { error: "day-closed" }), refused, "Today's games closed before your result arrived, so this game counted as lost."],
      [json(422, { error: "implausible-timing" }), refused, "Your result could not be checked, so this game counted as lost."],
      [json(500, { error: "server-error" }), notSent, unsent],
      [new Error("offline"), notSent, unsent],
    ];
    for (const [failure, heading, message] of cases) {
      respond(json(200, started), failure);
      await startRun();
      await finish([900], 1);
      expect((await screen.findByRole("alert")).textContent).toBe(message);
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: heading }));
      await userEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(refresh).toHaveBeenCalledTimes(1);
      cleanup();
      games.length = 0;
      refresh.mockReset();
    }
  });
});

// The page re-renders PlayToday with a fresh `initial` whenever the server refreshes it (T69).
describe("PlayToday across server refreshes (T69)", () => {
  const RELOAD = "Your day's latest state could not be loaded. Reload the page to see it.";

  it("keeps a running game when a refresh arrives", async () => {
    respond(json(200, started));
    const { rerender } = await startRun();
    rerender(page(dayOf(["in-progress"])));
    expect(screen.getByTestId("game")).toBeTruthy();
    expect(screen.queryByText(/haven't finished it here/)).toBeNull();
  });

  it("keeps checking the result when a refresh arrives meanwhile", async () => {
    respond(json(200, started));
    fetchSpy.mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = await startRun();
    await finish([900], 1);
    rerender(page(dayOf(["in-progress"])));
    expect(screen.getByText("Checking your result")).toBeTruthy();
  });

  it("keeps this game's verdict when a refresh arrives before Continue", async () => {
    respond(json(200, started), json(200, { score: 3, passed: false, passTarget: 12, day: progress(0, 1, null, 2) }));
    const { rerender } = await startRun();
    await finish([900], 3);
    await screen.findByRole("heading", { name: "Game 1 of 3: lost" });
    rerender(page(dayOf(["lost"])));
    expect(screen.getByRole("heading", { name: "Game 1 of 3: lost" })).toBeTruthy();
  });

  it.each(["already-started", "day-complete"])("reloads the day when the server says %s (another tab got there first)", async (error) => {
    respond(json(409, { error }));
    const { rerender } = render(page(fresh));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(page(dayOf(["in-progress"])));
    expect(await screen.findByRole("heading", { name: "Game 2 of 3: Swift Sum" })).toBeTruthy();
  });

  it("reloads the day when this game was already submitted elsewhere", async () => {
    respond(json(200, started), json(409, { error: "already-submitted" }));
    const { rerender } = await startRun();
    await finish([900], 1);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(page(dayOf(["lost"])));
    expect(list()[0]).toBe("Game 1: Teetering TowerLost");
  });

  it("shows the next day's games, saying why, when a start races the deadline", async () => {
    respond(json(409, { error: "day-closed" }));
    const { rerender } = render(page(dayOf(["won"])));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(page({ ...fresh, gameDate: "2026-11-09" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Today's games just closed. These are the next day's.");
    expect(screen.getByRole("heading", { name: "Game 1 of 3: Teetering Tower" })).toBeTruthy();
    expect(games).toHaveLength(0);
  });

  it("asks for a reload, rather than spinning, when the refresh brings nothing new", async () => {
    respond(json(409, { error: "already-started" }));
    render(page(fresh));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect((await screen.findByRole("alert")).textContent).toBe(RELOAD);
    expect(screen.getByRole("heading", { name: "Reload the page" })).toBeTruthy();
  });

  it("follows a refresh outside a run", () => {
    const { rerender } = render(page(fresh));
    rerender(page(dayOf(["won", "won"], { outcome: "passed" })));
    expect(screen.getByRole("heading", { name: "You passed today: two wins" })).toBeTruthy();
  });
});

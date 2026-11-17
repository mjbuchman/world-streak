import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Where ad slots may and may not appear (T44), with the development placeholders on so that
// every slot that exists renders. The pages' own data is stubbed where they read any.
const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims } })) }));
vi.mock("@/lib/attempts/today", () => ({
  todaysChallenge: vi.fn(async () => "stacking"),
  // A decided day, so /play/results shows its page.
  todaysDay: vi.fn(async () => ({ gameDate: "2026-11-08", games: [], wins: 2, losses: 0, outcome: "passed", nextPosition: 3 })),
}));
vi.mock("@/lib/profiles", () => ({ landingPath: vi.fn(async () => "/") }));
vi.mock("@/components/Meter", () => ({ Meter: () => null }));
vi.mock("@/components/ShareCard", () => ({ ShareCard: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));

import PlayPage from "./play/page";
import ResultsPage from "./play/results/page";
import FlashCountPracticePage from "./practice/flash-count/page";
import InnerClockPracticePage from "./practice/inner-clock/page";
import PracticePage from "./practice/page";
import StackingPracticePage from "./practice/stacking/page";
import RulesPage from "./rules/page";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ADS_PLACEHOLDER", "true");
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const slots = (markup: string) => [...markup.matchAll(/data-ad-slot="([^"]+)"/g)].map((match) => match[1]);

describe("ad slots", () => {
  it("/rules has one, below the rules", () => {
    expect(slots(renderToStaticMarkup(RulesPage()))).toEqual(["rules"]);
  });

  it("/play never has one: its games run there (T157 moved the slot to the results page)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    expect(slots(renderToStaticMarkup(await PlayPage()))).toEqual([]);
  });

  it("/play/results has one, below the results", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    expect(slots(renderToStaticMarkup(await ResultsPage()))).toEqual(["play-result"]);
  });

  it.each([
    ["/practice", PracticePage],
    ["/practice/stacking", StackingPracticePage],
    ["/practice/inner-clock", InnerClockPracticePage],
    ["/practice/flash-count", FlashCountPracticePage],
  ])("%s never has one", (_path, Page) => {
    expect(slots(renderToStaticMarkup(Page()))).toEqual([]);
  });
});

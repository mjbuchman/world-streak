import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Where ad slots may and may not appear (T44), with the development placeholders on so that
// every slot that exists renders. The pages' own data is stubbed where they read any.
const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims } })) }));
vi.mock("@/lib/attempts/today", () => ({
  todaysChallenge: vi.fn(async () => "stacking"),
  todaysAttempt: vi.fn(async () => ({ kind: "submitted", score: 7, passed: true, passTarget: 10 })),
}));
vi.mock("@/lib/profiles", () => ({ landingPath: vi.fn(async () => "/") }));
// The client game screens stand in with what they were given: /play's slot is a prop.
vi.mock("./play/PlayToday", () => ({ PlayToday: ({ afterResult }: { afterResult?: React.ReactNode }) => <>{afterResult}</> }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));

import PlayPage from "./play/page";
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

  it("/play hands its slot to the result screen, which shows it only after a result", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    expect(slots(renderToStaticMarkup(await PlayPage()))).toEqual(["play-result"]);
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

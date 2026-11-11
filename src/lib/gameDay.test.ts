import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEADLINE_UTC_HOUR } from "@/config/schedule";
import fixture from "./gameDay.fixture.json";
import { addDays, deadlineFor, gameDateAt } from "./gameDay";

describe("addDays", () => {
  it("moves a game date by whole days, across months, years and a leap day", () => {
    expect(addDays("2026-11-11", 1)).toBe("2026-11-12");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-11", 7)).toBe("2026-11-18");
  });
});

describe("gameDateAt", () => {
  it("uses a midnight UTC deadline", () => {
    expect(DEADLINE_UTC_HOUR).toBe(0);
  });

  it("gives the date that closes at the next deadline", () => {
    expect(gameDateAt(new Date("2026-11-07T23:59:59.999Z"))).toBe("2026-11-07");
    expect(gameDateAt(new Date("2026-11-08T00:00:00.000Z"))).toBe("2026-11-08");
  });

  it("follows an injected deadline hour", () => {
    expect(gameDateAt(new Date("2026-11-08T04:59:59Z"), 5)).toBe("2026-11-07");
    expect(gameDateAt(new Date("2026-11-08T05:00:00Z"), 5)).toBe("2026-11-08");
    expect(gameDateAt(new Date("2027-01-01T04:59:59Z"), 5)).toBe("2026-12-31");
  });

  it("rejects a deadline hour that is not a whole hour of the day", () => {
    for (const hour of [-1, 24, 1.5, Number.NaN]) {
      expect(() => gameDateAt(new Date("2026-11-08T00:00:00Z"), hour)).toThrow(/deadline hour/);
      expect(() => deadlineFor("2026-11-08", hour)).toThrow(/deadline hour/);
    }
  });

  it.each(fixture)("matches the shared boundary fixture: $at is $gameDate", ({ at, gameDate }) => {
    expect(gameDateAt(new Date(at))).toBe(gameDate);
  });
});

describe("deadlineFor", () => {
  it("is the next day at the deadline hour, in UTC", () => {
    expect(deadlineFor("2026-11-07").toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(deadlineFor("2026-12-31").toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(deadlineFor("2026-11-07", 5).toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });

  it("is the first instant of the next game date, and the one before it still belongs to this one", () => {
    for (const hour of [0, 5, 23]) {
      const deadline = deadlineFor("2028-02-28", hour);
      expect(gameDateAt(deadline, hour)).toBe("2028-02-29");
      expect(gameDateAt(new Date(deadline.getTime() - 1), hour)).toBe("2028-02-28");
    }
  });

  it("rejects anything that is not a real YYYY-MM-DD date", () => {
    for (const bad of ["2026-11-31", "2026-2-03", "20261107", ""]) {
      expect(() => deadlineFor(bad)).toThrow(/game date/);
    }
  });
});

describe("the SQL game_date_at test", () => {
  it("checks exactly the same boundary fixture", () => {
    // The close job runs in Postgres, so the deadline rule exists twice on purpose; both
    // sides test this one fixture so they cannot drift apart.
    const sql = readFileSync(path.resolve(import.meta.dirname, "../../supabase/tests/game_days.test.sql"), "utf8");
    const embedded = /\$fixture\$([\s\S]*?)\$fixture\$/.exec(sql);
    if (!embedded) throw new Error("the pgTAP test must embed the fixture between $fixture$ quotes");
    expect(JSON.parse(embedded[1])).toEqual(fixture);
  });
});

import { describe, expect, it } from "vitest";
import { fakeSupabase, type FakeResult as Result } from "@/lib/testing/fakeSupabase";
import { saveGameDayEdit } from "./adminEdit";

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
  const { db, queries } = fakeSupabase(results);
  return { db, calls: queries };
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};
const FIELDS = {
  gameDate: "2026-11-12",
  game1: "stacking",
  game2: "inner-clock",
  game3: "flash-count",
  target1: "9",
  target2: "0.5",
  target3: "15",
  thresholdPercent: "55",
};
const edit = (over: Record<string, string> = {}) => form({ ...FIELDS, ...over });

const ADMIN: Result = { data: true, error: null };
/** The open day as stored: Tower 10, Second Sense 0.5, Swift Sum 15 (out of position order, as an embed may be). */
const OPEN: Result = {
  data: {
    closed_at: null,
    game_day_games: [
      { position: 2, challenge_type: "inner-clock", pass_target: 0.5 },
      { position: 1, challenge_type: "stacking", pass_target: "10" },
      { position: 3, challenge_type: "flash-count", pass_target: 15 },
    ],
  },
  error: null,
};
const SAVED: Result = { data: true, error: null };

describe("saveGameDayEdit", () => {
  it("saves the lineup, the targets and the threshold as a fraction through save_game_day", async () => {
    const { db, calls } = fakeDb([ADMIN, OPEN, SAVED]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: true, message: "Saved Nov 12, 2026." });
    expect(calls[1]).toEqual([
      ["from", "game_days"],
      ["select", "closed_at, game_day_games(position, challenge_type, pass_target)"],
      ["eq", "game_date", "2026-11-12"],
      ["maybeSingle"],
    ]);
    expect(calls[2]).toEqual([
      [
        "rpc",
        "save_game_day",
        { d: "2026-11-12", games: ["stacking", "inner-clock", "flash-count"], targets: [9, 0.5, 15], threshold: 0.55 },
      ],
    ]);
  });

  it("refuses anyone who is not an admin, before reading or writing anything", async () => {
    const { db, calls } = fakeDb([{ data: false, error: null }]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: false, message: "Only admins can edit game days." });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["a threshold of 150%", { thresholdPercent: "150" }, "Survival threshold must be from 0% to 100%."],
    ["a negative threshold", { thresholdPercent: "-1" }, "Survival threshold must be from 0% to 100%."],
    ["a threshold that is not a number", { thresholdPercent: "lots" }, "Survival threshold must be a number."],
    ["a missing pass target", { target2: " " }, "Pass target for game 2 is required."],
    ["a negative pass target", { target3: "-2" }, "Pass target for game 3 cannot be negative."],
    ["a malformed date", { gameDate: "tomorrow" }, "Unknown game day."],
    ["an unknown game", { game2: "chess" }, "Unknown game."],
    ["a game twice", { game3: "stacking" }, "Pick three different games."],
  ])("refuses %s without touching the database", async (_name, over, message) => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await saveGameDayEdit(db, edit(over))).toEqual({ ok: false, message });
    expect(calls).toHaveLength(1);
  });

  it("refuses a form with no fields at all, without touching the database", async () => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await saveGameDayEdit(db, new FormData())).toEqual({ ok: false, message: "Unknown game day." });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["a game", "game1", "Unknown game."],
    ["a target", "target1", "Pass target for game 1 is required."],
    ["the threshold", "thresholdPercent", "Survival threshold is required."],
  ])("refuses a form missing %s", async (_name, field, message) => {
    const fields: Record<string, string> = { ...FIELDS };
    delete fields[field];
    const { db } = fakeDb([ADMIN]);
    expect(await saveGameDayEdit(db, form(fields))).toEqual({ ok: false, message });
  });

  it("refuses a closed day, and an unknown one", async () => {
    const closed = fakeDb([ADMIN, { data: { closed_at: "2026-11-13T00:00:05Z", game_day_games: [] }, error: null }]);
    expect(await saveGameDayEdit(closed.db, edit())).toEqual({ ok: false, message: "Nov 12, 2026 has closed, so it can no longer change." });
    expect(closed.calls).toHaveLength(2);
    const unknown = fakeDb([ADMIN, { data: null, error: null }]);
    expect(await saveGameDayEdit(unknown.db, edit())).toEqual({ ok: false, message: "Unknown game day." });
  });

  it("refuses a day that closes between the check and the save", async () => {
    const { db } = fakeDb([ADMIN, OPEN, { data: false, error: null }]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: false, message: "Nov 12, 2026 has closed, so it can no longer change." });
  });

  it("reports the database's lock on a started day's games (WS003) as a refusal", async () => {
    const locked = { data: null, error: { code: "WS003", message: "game day 2026-11-12 has started, so its lineup is locked" } };
    const { db } = fakeDb([ADMIN, OPEN, locked]);
    expect(await saveGameDayEdit(db, edit({ game1: "echo-path" }))).toEqual({
      ok: false,
      message: "Nov 12, 2026 has started, so its games can no longer change.",
    });
  });

  it("reports the database's lock on a started game's target (WS002) as a refusal", async () => {
    const locked = { data: null, error: { code: "WS002", message: "game 1 of game day 2026-11-12 has started" } };
    const { db } = fakeDb([ADMIN, OPEN, locked]);
    expect(await saveGameDayEdit(db, edit())).toEqual({
      ok: false,
      message: "A game on Nov 12, 2026 has started, so its pass target can no longer change. The rest still can.",
    });
  });

  it.each(["0", "16", "15.5"])("keeps a Tower target on the board's 15 rows (refuses %s, writing nothing)", async (target1) => {
    const { db, calls } = fakeDb([ADMIN, OPEN]);
    expect(await saveGameDayEdit(db, edit({ target1 }))).toEqual({ ok: false, message: "Game 1's pass target must be a row from 1 to 15." });
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["the lowest Tower target", { target1: "1" }, [1, 0.5, 15], 0.55],
    ["the highest Tower target", { target1: "15" }, [15, 0.5, 15], 0.55],
    ["a fractional Tower target", { target1: "1.5" }, [1.5, 0.5, 15], 0.55],
    ["any non-negative target for other games", { target3: "40" }, [9, 0.5, 40], 0.55],
    ["a threshold of 0%", { thresholdPercent: "0" }, [9, 0.5, 15], 0],
    ["a threshold of 100%", { thresholdPercent: "100" }, [9, 0.5, 15], 1],
  ])("accepts %s", async (_name, over, targets, threshold) => {
    const { db, calls } = fakeDb([ADMIN, OPEN, SAVED]);
    expect(await saveGameDayEdit(db, edit(over))).toMatchObject({ ok: true });
    expect(calls[2][0][2]).toMatchObject({ targets, threshold });
  });

  it("throws on a database error, so the page shows its error rather than a false message", async () => {
    const lookup = fakeDb([ADMIN, { data: null, error: { message: "down" } }]);
    await expect(saveGameDayEdit(lookup.db, edit())).rejects.toThrow("Game day lookup failed: down");
    const save = fakeDb([ADMIN, OPEN, { data: null, error: { code: "42501", message: "denied" } }]);
    await expect(saveGameDayEdit(save.db, edit())).rejects.toThrow("Saving the game day failed: denied");
  });

  describe("changing the games (T161)", () => {
    it("reorders the games, naming the new lineup", async () => {
      const { db, calls } = fakeDb([ADMIN, OPEN, SAVED]);
      const swapped = { game1: "inner-clock", game2: "stacking", target1: "0.5", target2: "10" };
      expect(await saveGameDayEdit(db, edit(swapped))).toEqual({
        ok: true,
        message: "Saved Nov 12, 2026. Its games are now Second Sense, Teetering Tower, Swift Sum.",
      });
      expect(calls[2][0][2]).toMatchObject({ games: ["inner-clock", "stacking", "flash-count"], targets: [0.5, 10, 15] });
    });

    it("says a new game whose old target was left as it was takes its default target", async () => {
      const { db } = fakeDb([ADMIN, OPEN, SAVED]);
      expect(await saveGameDayEdit(db, edit({ game2: "echo-path" }))).toEqual({
        ok: true,
        message:
          "Saved Nov 12, 2026. Its games are now Teetering Tower, Echo Path, Swift Sum. " +
          "A changed game with its old target left as it was takes its default pass target.",
      });
    });

    it("does not hold the old game's unchanged target to the Tower's rows when the Tower moves in", async () => {
      const { db } = fakeDb([ADMIN, OPEN, SAVED]);
      expect(await saveGameDayEdit(db, edit({ game1: "fair-split", game2: "stacking" }))).toMatchObject({ ok: true });
    });

    it("does hold a newly typed target to the Tower's rows when the Tower moves in", async () => {
      const { db, calls } = fakeDb([ADMIN, OPEN]);
      expect(await saveGameDayEdit(db, edit({ game1: "fair-split", game2: "stacking", target2: "40" }))).toEqual({
        ok: false,
        message: "Game 2's pass target must be a row from 1 to 15.",
      });
      expect(calls).toHaveLength(2);
    });
  });
});

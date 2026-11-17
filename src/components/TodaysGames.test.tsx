// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TodaysGames, type HomeGame } from "./TodaysGames";

afterEach(cleanup);

const games: HomeGame[] = [
  { challengeType: "stacking", status: "won" },
  { challengeType: "flash-count", status: "lost" },
  { challengeType: "inner-clock", status: "to-play" },
];
const card = () => screen.getByRole("region", { name: "Today's three games" });

describe("TodaysGames", () => {
  it("is the player's part today, with the pitch", () => {
    render(<TodaysGames games={games} />);
    expect(within(card()).getByText("Your part today")).toBeTruthy();
    expect(
      within(card()).getByText("Play today's three games; win two to pass; if enough of the world passes, humanity's streak survives."),
    ).toBeTruthy();
  });

  it("lists the games in order, each with its status", () => {
    render(<TodaysGames games={games} />);
    const items = within(card()).getAllByRole("listitem");
    expect(items.map((item) => [item.textContent, item.dataset.status])).toEqual([
      ["Teetering TowerWon", "won"],
      ["Swift SumLost", "lost"],
      ["Second SenseTo play", "to-play"],
    ]);
  });

  it("offers Play, practice for the next game to play, and every practice game", () => {
    render(<TodaysGames games={games} />);
    expect(within(card()).getByRole("link", { name: "Play" }).getAttribute("href")).toBe("/play");
    expect(within(card()).getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/inner-clock");
    expect(within(card()).getByRole("link", { name: "Practice any challenge" }).getAttribute("href")).toBe("/practice");
  });

  it("practises the first game once every game is played", () => {
    render(<TodaysGames games={games.map((game) => ({ ...game, status: "won" }))} />);
    expect(within(card()).getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/stacking");
  });
});

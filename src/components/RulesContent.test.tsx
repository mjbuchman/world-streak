// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RULES_CONFIG } from "@/lib/rules";
import { RulesContent } from "./RulesContent";
import { SiteFooter } from "./SiteFooter";

afterEach(cleanup);

const FILLED = { name: "Acme LLC", address: "1 Main St, Springfield", email: "rules@example.com" };

describe("RulesContent", () => {
  it("shows a Draft banner while a sponsor detail is a placeholder", () => {
    render(<RulesContent config={RULES_CONFIG} />);
    expect(screen.getByRole("note").textContent).toBe("Draft: these rules are not final and the prize draw is not open yet.");
  });

  it("drops the banner once every sponsor detail is filled in", () => {
    render(<RulesContent config={{ ...RULES_CONFIG, sponsor: FILLED }} />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByRole("region", { name: "Sponsor" }).textContent).toContain("Acme LLC");
  });

  it("gives each rule a heading, and follows the config (a different age and prize change the text)", () => {
    render(<RulesContent config={{ ...RULES_CONFIG, minAge: 21, prizeCents: 50_000 }} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Free to enter",
      "Who can enter",
      "How a game day works",
      "The world streak",
      "Cycles and the goal",
      "The prize",
      "Entries and the draw",
      "Winner and payment",
      "Sponsor",
    ]);
    expect(screen.getByRole("region", { name: "Who can enter" }).textContent).toContain("at least 21 years old");
    expect(screen.getByRole("region", { name: "The prize" }).textContent).toContain("The prize is $500 per cycle");
  });
});

describe("SiteFooter", () => {
  it("links to the official rules", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Official rules" }).getAttribute("href")).toBe("/rules");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./passwords";

describe("password rules", () => {
  it("are 8 to 72 characters (bcrypt, which Supabase uses, reads at most 72)", () => {
    expect([MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]).toEqual([8, 72]);
  });

  it("match the minimum local Supabase Auth enforces", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    const setting = /^minimum_password_length\s*=\s*(\d+)\s*$/m.exec(config);
    expect(Number(setting?.[1])).toBe(MIN_PASSWORD_LENGTH);
  });
});

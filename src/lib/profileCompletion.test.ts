import { describe, expect, it, vi } from "vitest";
import { completeProfile, type CompleteProfileDeps } from "./profileCompletion";
import { refusalMessage } from "./eligibility";

const TODAY = "2026-11-08";

function form(overrides: Record<string, string | undefined> = {}): FormData {
  const fields: Record<string, string | undefined> = { birthDate: "1990-05-05", country: "us", agree: "on", ...overrides };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data.set(key, value);
  return data;
}

function deps(created = true): CompleteProfileDeps & { createProfile: ReturnType<typeof vi.fn> } {
  return { today: TODAY, createProfile: vi.fn(async () => created) };
}

describe("completeProfile", () => {
  it("creates the profile for an eligible player, with the country upper-cased", async () => {
    const d = deps();
    expect(await completeProfile(form(), d)).toEqual({ ok: true });
    expect(d.createProfile).toHaveBeenCalledWith({ birthDate: "1990-05-05", country: "US" });
  });

  it("refuses an underage player without creating a profile", async () => {
    const d = deps();
    // 18 tomorrow.
    const result = await completeProfile(form({ birthDate: "2008-11-09" }), d);
    expect(result).toEqual({ ok: false, message: refusalMessage(), values: { birthDate: "2008-11-09", country: "us" } });
    expect(d.createProfile).not.toHaveBeenCalled();
  });

  it("accepts a player who turns 18 today", async () => {
    const d = deps();
    expect(await completeProfile(form({ birthDate: "2008-11-08" }), d)).toEqual({ ok: true });
  });

  it("refuses a player outside the allowed countries without creating a profile", async () => {
    const d = deps();
    const result = await completeProfile(form({ country: "ZZ" }), d);
    expect(result).toMatchObject({ ok: false, message: refusalMessage() });
    expect(d.createProfile).not.toHaveBeenCalled();
  });

  it("reports every missing field and keeps what was entered", async () => {
    const d = deps();
    const result = await completeProfile(form({ birthDate: "", country: undefined, agree: undefined }), d);
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        birthDate: "Enter a valid date of birth.",
        country: "Select your country of residence.",
        agree: "You need to agree to the official rules.",
      },
      values: { birthDate: "", country: "" },
    });
    expect(d.createProfile).not.toHaveBeenCalled();
  });

  it("shows a generic error when the profile cannot be saved", async () => {
    const result = await completeProfile(form(), deps(false));
    expect(result).toMatchObject({ ok: false, message: "Something went wrong. Please try again." });
  });
});

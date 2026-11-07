import { describe, expect, it } from "vitest";
import { checkDatabase } from "./health";

const unavailable = { status: 503, body: { db: "unavailable" } };

describe("checkDatabase", () => {
  it("reports ok when the probe returns true without an error", async () => {
    expect(await checkDatabase(async () => ({ data: true, error: null }))).toEqual({
      status: 200,
      body: { db: "ok" },
    });
  });

  it("reports unavailable when the probe returns an error", async () => {
    const result = await checkDatabase(async () => ({ data: null, error: { message: "connection refused" } }));
    expect(result).toEqual(unavailable);
  });

  it("reports unavailable when the probe returns anything other than true", async () => {
    expect(await checkDatabase(async () => ({ data: false, error: null }))).toEqual(unavailable);
    expect(await checkDatabase(async () => ({ data: "true", error: null }))).toEqual(unavailable);
  });

  it("reports unavailable when the probe throws or rejects", async () => {
    const throws = () => {
      throw new Error("Missing environment variable");
    };
    expect(await checkDatabase(throws)).toEqual(unavailable);
    expect(await checkDatabase(() => Promise.reject(new Error("fetch failed")))).toEqual(unavailable);
  });
});

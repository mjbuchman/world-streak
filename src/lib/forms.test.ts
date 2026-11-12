import { describe, expect, it } from "vitest";
import { collectFieldErrors, emailSchema, readFields, textValue } from "./forms";

describe("emailSchema", () => {
  it("trims and lower-cases a valid address", () => {
    expect(emailSchema.parse("  Player@Example.COM ")).toBe("player@example.com");
  });

  it("refuses anything else with one message", () => {
    const result = emailSchema.safeParse("not-an-email");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Enter a valid email address.");
  });
});

describe("readFields", () => {
  it("reads each named field, with undefined for a missing one", () => {
    const form = new FormData();
    form.set("email", "a@example.com");
    form.set("ignored", "x");
    expect(readFields(form, ["email", "password"])).toEqual({ email: "a@example.com", password: undefined });
  });
});

describe("textValue", () => {
  it("passes strings through unchanged", () => {
    expect(textValue(" a b ")).toBe(" a b ");
  });

  it.each([undefined, null, 42, new Blob(["x"])])("turns %o into an empty string", (value) => {
    expect(textValue(value)).toBe("");
  });
});

describe("collectFieldErrors", () => {
  it("keeps the first message for each field", () => {
    expect(
      collectFieldErrors([
        { path: ["email"], message: "first" },
        { path: ["email"], message: "second" },
        { path: ["password"], message: "too short" },
      ]),
    ).toEqual({ email: "first", password: "too short" });
  });

  it("uses the top-level field of a nested path", () => {
    expect(collectFieldErrors([{ path: ["address", "zip"], message: "bad zip" }])).toEqual({ address: "bad zip" });
  });

  it("ignores issues without a named field", () => {
    expect(collectFieldErrors([{ path: [], message: "form" }, { path: [0], message: "index" }])).toEqual({});
  });
});

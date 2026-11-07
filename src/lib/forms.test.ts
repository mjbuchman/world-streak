import { describe, expect, it } from "vitest";
import { collectFieldErrors, textValue } from "./forms";

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

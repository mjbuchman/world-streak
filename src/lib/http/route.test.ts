import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser } }) }));

import { errorResponse, jsonNoStore, readJsonBody, requireUser, withServerErrors } from "./route";

const request = (body: string, headers?: Record<string, string>) =>
  new Request("http://localhost/api/test", { method: "POST", body, headers });

beforeEach(() => {
  getUser.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("jsonNoStore", () => {
  it("answers JSON with the given status and cache-control: no-store", async () => {
    const response = jsonNoStore({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("defaults to 200", () => {
    expect(jsonNoStore({}).status).toBe(200);
  });
});

describe("errorResponse", () => {
  it("answers { error: code } with the status, uncached", async () => {
    const response = errorResponse(422, "implausible-timing");
    expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "implausible-timing" });
  });
});

describe("requireUser", () => {
  it("returns the user the Auth server verified", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(await requireUser()).toEqual({ user: { id: "u1" } });
  });

  it("returns a ready 401 when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing" } });
    const result = await requireUser();
    if (!("response" in result)) throw new Error("expected a response");
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    expect(await result.response.json()).toEqual({ error: "unauthenticated" });
  });
});

describe("readJsonBody", () => {
  it("parses a JSON body within the limit", async () => {
    expect(await readJsonBody(request('{"a":1}'), 100)).toEqual({ body: { a: 1 } });
  });

  it("accepts a body of exactly the limit", async () => {
    const body = JSON.stringify({ pad: "x".repeat(10) });
    expect(await readJsonBody(request(body), new TextEncoder().encode(body).length)).toEqual({
      body: { pad: "x".repeat(10) },
    });
  });

  it("refuses with 413 when the declared length is over the limit, without reading the body", async () => {
    const req = request("{}", { "content-length": "1000" });
    const text = vi.spyOn(req, "text");
    const result = await readJsonBody(req, 100);
    if (!("response" in result)) throw new Error("expected a response");
    expect(result.response.status).toBe(413);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    expect(await result.response.json()).toEqual({ error: "too-large" });
    expect(text).not.toHaveBeenCalled();
  });

  it("accepts a declared length of exactly the limit", async () => {
    expect(await readJsonBody(request("{}", { "content-length": "100" }), 100)).toEqual({ body: {} });
  });

  it("ignores a malformed declared length and still checks the actual size", async () => {
    expect(await readJsonBody(request("{}", { "content-length": "abc" }), 100)).toEqual({ body: {} });
    const result = await readJsonBody(request(JSON.stringify("x".repeat(200)), { "content-length": "abc" }), 100);
    if (!("response" in result)) throw new Error("expected a response");
    expect(result.response.status).toBe(413);
  });

  it("refuses with 413 when the actual size is over the limit, counting bytes not characters", async () => {
    // 40 three-byte characters: 40 characters but 120 bytes (plus the quotes).
    const result = await readJsonBody(request(JSON.stringify("€".repeat(40))), 100);
    if (!("response" in result)) throw new Error("expected a response");
    expect(result.response.status).toBe(413);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    expect(await result.response.json()).toEqual({ error: "too-large" });
  });

  it("refuses with 400 when the body is not JSON", async () => {
    const result = await readJsonBody(request("not json"), 100);
    if (!("response" in result)) throw new Error("expected a response");
    expect(result.response.status).toBe(400);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    expect(await result.response.json()).toEqual({ error: "invalid-body" });
  });
});

describe("withServerErrors", () => {
  it("passes the handler's response and arguments through", async () => {
    const handler = vi.fn(async (req: Request) => jsonNoStore({ url: req.url }, 202));
    const wrapped = withServerErrors("Testing", handler);
    const response = await wrapped(request("{}"));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ url: "http://localhost/api/test" });
  });

  it("logs a thrown error and answers 500 without its details", async () => {
    const failure = new Error("connection refused at 10.0.0.5");
    const wrapped = withServerErrors("Starting an attempt failed", async () => {
      throw failure;
    });
    const response = await wrapped();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "server-error" });
    expect(text).not.toContain("refused");
    expect(console.error).toHaveBeenCalledWith("Starting an attempt failed", failure);
  });
});

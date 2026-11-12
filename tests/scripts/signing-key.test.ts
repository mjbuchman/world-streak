import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureSigningKeys, newSigningKey } from "../../scripts/signing-key.mts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempFile() {
  const dir = mkdtempSync(path.join(tmpdir(), "signing-key-"));
  dirs.push(dir);
  return path.join(dir, "signing_keys.json");
}

describe("newSigningKey", () => {
  it("is an ES256 private JWK in the shape `supabase gen signing-key` prints", () => {
    const key = newSigningKey();
    expect(key).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", key_ops: ["sign", "verify"], ext: true });
    expect(key.kid).toMatch(/^[0-9a-f-]{36}$/);
    for (const part of [key.d, key.x, key.y]) expect(part).toMatch(/^[\w-]{43}$/);
  });

  it("signs a token that its public half verifies", () => {
    const key = newSigningKey();
    const data = Buffer.from("header.payload");
    const signature = sign("sha256", data, createPrivateKey({ key, format: "jwk" }));
    expect(verify("sha256", data, createPublicKey({ key, format: "jwk" }), signature)).toBe(true);
  });

  it("is new every time", () => {
    const [a, b] = [newSigningKey(), newSigningKey()];
    expect(a.kid).not.toBe(b.kid);
    expect(a.d).not.toBe(b.d);
  });
});

describe("ensureSigningKeys", () => {
  it("writes a one-key array when the file is missing", () => {
    const file = tempFile();
    expect(ensureSigningKeys(file)).toBe("created");
    const text = readFileSync(file, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    const keys = JSON.parse(text) as { alg: string; d?: string }[];
    expect(keys).toHaveLength(1);
    expect(keys[0].alg).toBe("ES256");
    expect(keys[0].d).toBeTruthy();
  });

  it("leaves an existing file alone, so sessions signed with it stay valid", () => {
    const file = tempFile();
    writeFileSync(file, "[\"existing\"]");
    expect(ensureSigningKeys(file)).toBe("kept");
    expect(readFileSync(file, "utf8")).toBe("[\"existing\"]");
  });
});

import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureSigningKeys, newSigningKey } from "../../scripts/signing-key.mts";

function tempFile() {
  const dir = mkdtempSync(path.join("test-results", "signing-key-"));
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
    expect(newSigningKey().kid).not.toBe(newSigningKey().kid);
  });
});

describe("ensureSigningKeys", () => {
  it("writes a one-key array when the file is missing", () => {
    const file = tempFile();
    expect(ensureSigningKeys(file)).toBe("created");
    const keys = JSON.parse(readFileSync(file, "utf8")) as { alg: string }[];
    expect(keys).toHaveLength(1);
    expect(keys[0].alg).toBe("ES256");
  });

  it("leaves an existing file alone, so sessions signed with it stay valid", () => {
    const file = tempFile();
    writeFileSync(file, "[\"existing\"]");
    expect(ensureSigningKeys(file)).toBe("kept");
    expect(readFileSync(file, "utf8")).toBe("[\"existing\"]");
  });
});

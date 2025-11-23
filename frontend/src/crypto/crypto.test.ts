import { describe, expect, it } from "vitest";

import {
  computeTitleHmac,
  decryptOneTimePayload,
  decryptSecret,
  deriveMasterContext,
  encryptOneTimePayload,
  encryptSecret,
  getRandomBytes
} from "./crypto";

describe("crypto module", () => {
  it("encrypts and decrypts a secret with the same master context", async () => {
    const salt = getRandomBytes(16);
    const ctx = await deriveMasterContext("correct horse battery staple", salt);
    const original = "super-secret-value";

    const { ciphertext, iv, salt: itemSalt } = await encryptSecret(original, ctx);
    const roundtrip = await decryptSecret(ciphertext, iv, itemSalt, ctx);

    expect(roundtrip).toBe(original);
  });

  it("fails to decrypt with a different master context", async () => {
    const salt1 = getRandomBytes(16);
    const salt2 = getRandomBytes(16);
    const ctx1 = await deriveMasterContext("passphrase-one", salt1);
    const ctx2 = await deriveMasterContext("passphrase-two", salt2);

    const { ciphertext, iv, salt: itemSalt } = await encryptSecret("value", ctx1);

    await expect(decryptSecret(ciphertext, iv, itemSalt, ctx2)).rejects.toBeDefined();
  });

  it("computes deterministic HMAC for a title", async () => {
    const salt = getRandomBytes(16);
    const ctx = await deriveMasterContext("title-pass", salt);

    const h1 = await computeTitleHmac("Example", ctx);
    const h2 = await computeTitleHmac("Example", ctx);
    const h3 = await computeTitleHmac("Different", ctx);

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("encrypts and decrypts a one-time payload with a passphrase", async () => {
    const passphrase = "ephemeral-key";
    const payload = JSON.stringify({ hello: "world" });

    const { payload: cipher, salt, iv } = await encryptOneTimePayload(payload, passphrase);
    const roundtrip = await decryptOneTimePayload(cipher, salt, iv, passphrase);

    expect(roundtrip).toBe(payload);
  });
});



const ENC_LABEL = new TextEncoder().encode("aami-enc-root");
const AUTH_LABEL = new TextEncoder().encode("aami-auth");
const SEARCH_LABEL = new TextEncoder().encode("aami-search");
const ITEM_LABEL = new TextEncoder().encode("aami-item");
const OT_LABEL = new TextEncoder().encode("aami-ot");

export type MasterContext = {
  masterKey: ArrayBuffer;
  masterSalt: Uint8Array;
  encryptionRootBytes: ArrayBuffer;
  encryptionRootKey: CryptoKey;
  searchKey: CryptoKey;
};

export function getRandomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return buffer;
}

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.byteLength; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function hkdfExpand(
  keyMaterial: ArrayBuffer,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey("raw", keyMaterial, "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info
    },
    baseKey,
    length * 8
  );
}

export async function deriveMasterContext(passphrase: string, masterSalt: Uint8Array): Promise<MasterContext> {
  // PBKDF2 fallback KDF (Argon2id would be preferred but requires WASM integration).
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const masterKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: masterSalt,
      iterations: 600_000
    },
    baseKey,
    32 * 8
  );

  const encryptionRootBytes = await hkdfExpand(masterKey, masterSalt, ENC_LABEL, 32);
  const encryptionRootKey = await crypto.subtle.importKey(
    "raw",
    encryptionRootBytes,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );

  const searchKeyBits = await hkdfExpand(masterKey, masterSalt, SEARCH_LABEL, 32);
  const searchKey = await crypto.subtle.importKey(
    "raw",
    searchKeyBits,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return {
    masterKey,
    masterSalt,
    encryptionRootBytes,
    encryptionRootKey,
    searchKey
  };
}

async function deriveItemKey(ctx: MasterContext, itemSalt: Uint8Array): Promise<CryptoKey> {
  const itemKeyBits = await hkdfExpand(ctx.encryptionRootBytes, itemSalt, ITEM_LABEL, 32);
  return crypto.subtle.importKey("raw", itemKeyBits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(
  plaintext: string,
  ctx: MasterContext
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const itemSalt = getRandomBytes(16);
  const ivBytes = getRandomBytes(12);
  const key = await deriveItemKey(ctx, itemSalt);

  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, encoded);

  return {
    ciphertext: toBase64(ciphertextBuf),
    iv: toBase64(ivBytes),
    salt: toBase64(itemSalt)
  };
}

export async function decryptSecret(
  ciphertextB64: string,
  ivB64: string,
  saltB64: string,
  ctx: MasterContext
): Promise<string> {
  const ciphertext = fromBase64(ciphertextB64);
  const iv = fromBase64(ivB64);
  const salt = fromBase64(saltB64);

  const key = await deriveItemKey(ctx, salt);
  const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintextBuf);
}

export async function computeTitleHmac(title: string, ctx: MasterContext): Promise<string> {
  const data = new TextEncoder().encode(title);
  const sig = await crypto.subtle.sign("HMAC", ctx.searchKey, data);
  return toBase64(sig);
}

export async function deriveEphemeralKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 200_000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptOneTimePayload(
  plaintext: string,
  passphrase: string
): Promise<{ payload: string; salt: string; iv: string }> {
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveEphemeralKey(passphrase, salt);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    payload: toBase64(ciphertext),
    salt: toBase64(salt),
    iv: toBase64(iv)
  };
}

export async function decryptOneTimePayload(
  payloadB64: string,
  saltB64: string,
  ivB64: string,
  passphrase: string
): Promise<string> {
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const payload = fromBase64(payloadB64);
  const key = await deriveEphemeralKey(passphrase, salt);
  const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
  return new TextDecoder().decode(plaintextBuf);
}



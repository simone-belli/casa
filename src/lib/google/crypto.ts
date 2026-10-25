import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** The 32-byte key from AGENDA_TOKEN_KEY (base64), used to encrypt the Google refresh token. */
function key(): Buffer {
  const raw = process.env.AGENDA_TOKEN_KEY;
  const bytes = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (bytes.length !== 32) throw new Error("AGENDA_TOKEN_KEY must be 32 random bytes, base64-encoded.");
  return bytes;
}

/** AES-256-GCM, stored as base64 of iv | tag | ciphertext. */
export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(stored: string): string {
  const bytes = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export const randomToken = () => randomBytes(24).toString("base64url");

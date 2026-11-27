import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

function key(): Buffer {
  if (!config.encryptionKey) throw new Error("ENCRYPTION_KEY ist nicht gesetzt.");
  return createHash("sha256").update(config.encryptionKey).digest();
}

/** AES-256-GCM, Ausgabe: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, body] = payload.split(".");
  if (version !== "v1" || !iv || !tag || body === undefined) throw new Error("Ungueltiges Geheimnis-Format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

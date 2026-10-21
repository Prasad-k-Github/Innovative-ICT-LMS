import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// APP_SECRET: සංකේතනය (AES-256-GCM) සහ audit chain HMAC සඳහා මූලික රහස. Production හි අනිවාර්යයි (අවම අක්ෂර 32).
// Dev හි පමණක් ආරක්ෂිත නොවන පෙරනිමියක් භාවිතා වේ.
const DEV_FALLBACK = "dev-only-insecure-secret-do-not-use-in-production-0000";

function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set (at least 32 characters) in production");
  }
  return DEV_FALLBACK;
}

const keyCache = new Map<string, Buffer>();
// එක් රහසකින් අරමුණට වෙන් වූ යතුරු (key separation)
function subKey(purpose: string): Buffer {
  const secret = appSecret();
  const id = `${purpose}:${secret.length}:${secret.slice(0, 4)}`;
  let k = keyCache.get(id);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", secret, "innovative-ict", purpose, 32));
    keyCache.set(id, k);
  }
  return k;
}

// AES-256-GCM: v1.<iv>.<tag>.<ciphertext> (base64url)
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", subKey("data-encryption"), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, ct] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("bad ciphertext");
  const d = createDecipheriv("aes-256-gcm", subKey("data-encryption"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export function hmac(purpose: string, data: string): string {
  return createHmac("sha256", subKey(purpose)).update(data).digest("hex");
}

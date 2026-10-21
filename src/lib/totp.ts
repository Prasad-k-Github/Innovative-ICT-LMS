import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { hmac } from "./secrets";

// RFC 6238 TOTP (SHA-1, ඉලක්කම් 6, තත්පර 30) — Google Authenticator / Microsoft Authenticator / Authy අනුකූල
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

// නිවැරදි නම් ගැළපුණු step එක ලබා දෙයි (±1 කාල කවුළුව). lastStep ට වඩා වැඩි විය යුතුය: එකම code නැවත භාවිතා කළ නොහැක
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const cur = currentStep(now);
  for (const step of [cur, cur - 1, cur + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafe(totpAtStep(secret, step), clean)) return step;
  }
  return null;
}

function timingSafe(a: string, b: string) {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return a.length === b.length && r === 0;
}

export function otpauthUri(email: string, secret: string) {
  const label = encodeURIComponent(`Innovative ICT:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Innovative ICT")}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// Recovery codes: xxxxx-xxxxx (හෙක්ස්). ගබඩා කරන්නේ HMAC hash පමණි; සෑම code එකක්ම එක් වරක් පමණි
export function generateRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => {
    const h = randomBytes(5).toString("hex");
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
export const normalizeRecovery = (c: string) => c.trim().toLowerCase().replace(/\s+/g, "");
export const hashRecoveryCode = (c: string) => hmac("mfa-recovery", normalizeRecovery(c));

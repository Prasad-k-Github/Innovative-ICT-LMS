import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// මුරපද hashing: scrypt (Node හි native, libuv thread pool එකේ ධාවනය වේ -> එකවර බොහෝ දෙනා login වන විට server එක අවහිර නොවේ).
// පරාමිති OWASP නිර්දේශය (N=2^15, r=8, p=3). Hash එකේම පරාමිති ගබඩා වන නිසා පසුව වෙනස් කළ හැක (login වන විට ස්වයංක්‍රීයව නැවත hash වේ).
// පැරණි bcrypt hashes ($2...) තවමත් තහවුරු කළ හැක; සාර්ථක login එකකදී scrypt වලට උත්ශ්‍රේණි වේ (needsRehash).
const SCRYPT = { N: 1 << 15, r: 8, p: 3, keylen: 64 };
const SCRYPT_MAXMEM = 128 * 1024 * 1024;
const scryptAsync = (password: string, salt: Buffer, keylen: number, o: { N: number; r: number; p: number }) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, keylen, { ...o, maxmem: SCRYPT_MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, hash: string) {
  if (hash.startsWith("scrypt$")) {
    const [, n, r, p, saltB64, keyB64] = hash.split("$");
    const salt = Buffer.from(saltB64 ?? "", "base64");
    const expected = Buffer.from(keyB64 ?? "", "base64");
    const o = { N: Number(n), r: Number(r), p: Number(p) };
    if (!salt.length || !expected.length || !Number.isInteger(o.N) || !Number.isInteger(o.r) || !Number.isInteger(o.p)) return false;
    const key = await scryptAsync(password, salt, expected.length, o);
    return key.length === expected.length && timingSafeEqual(key, expected);
  }
  return bcrypt.compare(password, hash); // පැරණි (legacy) bcrypt hashes
}

// පැරණි bcrypt හෝ දුර්වල පරාමිති සහිත hash එකක් නම් true (සාර්ථක login එකකදී නැවත hash කිරීමට)
export function needsRehash(hash: string) {
  if (!hash.startsWith("scrypt$")) return true;
  const [, n, r, p] = hash.split("$");
  return Number(n) !== SCRYPT.N || Number(r) !== SCRYPT.r || Number(p) !== SCRYPT.p;
}

// Random token එක user ට යවයි; database එකේ ගබඩා කරන්නේ hash එක පමණයි
export function generateToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

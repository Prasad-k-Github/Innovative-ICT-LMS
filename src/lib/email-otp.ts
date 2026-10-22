import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOtps } from "@/db/schema";
import { hmac } from "./secrets";

import { OTP_MAX_ATTEMPTS, OTP_MINUTES, OTP_RESEND_SECONDS } from "./otp-config";

const hashCode = (userId: string, code: string) => hmac("email-otp", `${userId}:${code}`);

// අලුත් ඉලක්කම් 6ක code එකක් සාදයි (පරණ එක ප්‍රතිස්ථාපනය වේ). Raw code එක email එකෙන් යැවීමට ආපසු දෙයි.
export async function issueEmailOtp(userId: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0"); // CSPRNG
  const expiresAt = new Date(Date.now() + OTP_MINUTES * 60_000);
  await db
    .insert(emailOtps)
    .values({ userId, codeHash: hashCode(userId, code), expiresAt, attempts: 0, lastSentAt: new Date() })
    .onConflictDoUpdate({ target: emailOtps.userId, set: { codeHash: hashCode(userId, code), expiresAt, attempts: 0, lastSentAt: new Date() } });
  return { code, expiresAt };
}

// ඉතිරි cooldown තත්පර (0 = දැන් නැවත යැවිය හැක)
export async function resendWaitSeconds(userId: string) {
  const [row] = await db.select({ at: emailOtps.lastSentAt }).from(emailOtps).where(eq(emailOtps.userId, userId)).limit(1);
  if (!row) return 0;
  return Math.max(0, Math.ceil((row.at.getTime() + OTP_RESEND_SECONDS * 1000 - Date.now()) / 1000));
}

export type OtpResult = "ok" | "wrong" | "expired" | "locked";

// code එක පරීක්ෂා කරයි. වැරදි උත්සාහ atomic ලෙස ගණන් කර, සීමාව ඉක්මවූ විට (නිවැරදි code එකක් වුවද) ප්‍රතික්ෂේප කරයි.
export async function checkEmailOtp(userId: string, code: string): Promise<OtpResult> {
  // උත්සාහය ගණන් කර ගැනීම මුලින්ම (parallel guessing වලක්වයි)
  const [row] = await db
    .update(emailOtps)
    .set({ attempts: sql`${emailOtps.attempts} + 1` })
    .where(eq(emailOtps.userId, userId))
    .returning();
  if (!row) return "expired";
  if (row.expiresAt.getTime() <= Date.now()) return "expired";
  if (row.attempts > OTP_MAX_ATTEMPTS) return "locked";
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(hashCode(userId, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "wrong";
  await db.delete(emailOtps).where(eq(emailOtps.userId, userId)); // එක් වරක් පමණක් භාවිතා කළ හැක
  return "ok";
}

export async function clearEmailOtp(userId: string) {
  await db.delete(emailOtps).where(eq(emailOtps.userId, userId));
}

"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/crypto";
import { localized } from "@/lib/i18n/server";
import { rateCheck, rateHit, rateLimitReset } from "@/lib/rate-limit";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { getCurrentSessionId, requireAdmin, requireUser } from "@/lib/session";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotp } from "@/lib/totp";
import type { FormState } from "@/lib/validators";

// Authentication (2-step verification) සහ session කළමනාකරණය. සෑම action එකක්ම requireUser()/requireAdmin() සමඟ පරීක්ෂා කරයි.

const TEN_MIN = 10 * 60 * 1000;
const refresh = () => revalidatePath("/", "layout");

/* ----------------------- 2-step verification (Admin / Super Admin) ----------------------- */

// 1 වන පියවර: නව රහසක් සාදා (සංකේතනය කර) ගබඩා කරයි. තවම සක්‍රිය නොවේ (mfaEnabledAt = null).
export async function beginMfaSetupAction() {
  const me = await requireAdmin();
  const [u] = await db.select({ enabled: users.mfaEnabledAt }).from(users).where(eq(users.id, me.id)).limit(1);
  if (u?.enabled) return;
  await db
    .update(users)
    .set({ mfaSecretEnc: encryptSecret(generateTotpSecret()), mfaEnabledAt: null, mfaRecoveryHashes: null, mfaLastStep: null })
    .where(eq(users.id, me.id));
  refresh();
}

// 2 වන පියවර: Authenticator app එකේ code එක නිවැරදි නම් සක්‍රිය කර recovery codes පෙන්වයි
async function confirmMfaImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  if (!(await rateCheck(`mfa-setup:${me.id}`, 8, TEN_MIN))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  const [u] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!u?.mfaSecretEnc || u.mfaEnabledAt) return { error: "2-step verification සැකසුම ආරම්භ කර නැත." };

  const step = verifyTotp(decryptSecret(u.mfaSecretEnc), String(formData.get("code") ?? ""), null);
  if (step === null) {
    await rateHit(`mfa-setup:${me.id}`, TEN_MIN);
    return { fieldErrors: { code: ["Code එක වැරදියි. Authenticator app එකේ වත්මන් code එක ඇතුළත් කරන්න."] } };
  }
  const { codes, hashes } = generateRecoveryCodes();
  await db
    .update(users)
    .set({ mfaEnabledAt: new Date(), mfaRecoveryHashes: hashes, mfaLastStep: step })
    .where(eq(users.id, me.id));
  await rateLimitReset(`mfa-setup:${me.id}`);
  await audit(me.id, "mfa.enable", undefined, undefined, me.id);
  // සටහන: මෙහි revalidate නොකරයි: එසේ කළහොත් recovery codes පෙන්වන form එක ඉවත් වේ. පරිශීලකයා "සුරැකුවා" ඔබන විට නවීකරණය වේ.
  return { ok: true, message: "2-step verification සක්‍රිය කරන ලදී.", codes };
}

// නව recovery codes (පැරණි ඒවා අවලංගු වේ). මුරපදය අවශ්‍යයි (step-up)
async function regenerateRecoveryImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const err = await checkPassword(me.id, String(formData.get("password") ?? ""), "mfa-regen");
  if (err) return err;
  const [u] = await db.select({ enabled: users.mfaEnabledAt }).from(users).where(eq(users.id, me.id)).limit(1);
  if (!u?.enabled) return { error: "2-step verification සක්‍රිය කර නැත." };
  const { codes, hashes } = generateRecoveryCodes();
  await db.update(users).set({ mfaRecoveryHashes: hashes }).where(eq(users.id, me.id));
  await audit(me.id, "mfa.recovery_regenerate", undefined, undefined, me.id);
  return { ok: true, message: "නව recovery codes සාදන ලදී. පැරණි ඒවා අවලංගුයි.", codes };
}

// අක්‍රිය කිරීම: මුරපදය සහ වත්මන් code (හෝ recovery code) අවශ්‍යයි
async function disableMfaImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const err = await checkPassword(me.id, String(formData.get("password") ?? ""), "mfa-disable");
  if (err) return err;
  const [u] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!u?.mfaSecretEnc) return { error: "2-step verification සක්‍රිය කර නැත." };
  const code = String(formData.get("code") ?? "");
  const okTotp = verifyTotp(decryptSecret(u.mfaSecretEnc), code, u.mfaLastStep) !== null;
  const okRecovery = !!u.mfaRecoveryHashes?.includes(hashRecoveryCode(code));
  if (!okTotp && !okRecovery) {
    await rateHit(`mfa-disable:${me.id}`, TEN_MIN);
    return { fieldErrors: { code: ["Code එක වැරදියි."] } };
  }
  await db
    .update(users)
    .set({ mfaSecretEnc: null, mfaEnabledAt: null, mfaRecoveryHashes: null, mfaLastStep: null })
    .where(eq(users.id, me.id));
  await audit(me.id, "mfa.disable", undefined, undefined, me.id);
  refresh();
  return { ok: true, message: "2-step verification අක්‍රිය කරන ලදී." };
}

async function checkPassword(userId: string, password: string, key: string): Promise<FormState | null> {
  if (!(await rateCheck(`${key}:${userId}`, 5, TEN_MIN))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !(await verifyPassword(password, row.hash))) {
    await rateHit(`${key}:${userId}`, TEN_MIN);
    return { fieldErrors: { password: ["මුරපදය වැරදියි"] } };
  }
  return null;
}

/* ----------------------------------- Sessions ----------------------------------- */

// එක් session එකක් අවසන් කරයි (තමාගේම session පමණක්: where userId = me)
export async function revokeSessionAction(id: string) {
  const me = await requireUser();
  const r = await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, me.id))).returning({ id: sessions.id });
  if (r.length) await audit(me.id, "session.revoke", undefined, undefined, me.id);
  refresh();
}

// වත්මන් එක හැර අනෙක් සියලු devices වලින් logout කරයි
export async function revokeOtherSessionsAction() {
  const me = await requireUser();
  const current = await getCurrentSessionId();
  const r = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, me.id), current ? ne(sessions.id, current) : undefined))
    .returning({ id: sessions.id });
  await audit(me.id, "session.revoke_others", undefined, String(r.length), me.id);
  refresh();
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function confirmMfaAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await confirmMfaImpl(prev, fd));
}
export async function regenerateRecoveryAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await regenerateRecoveryImpl(prev, fd));
}
export async function disableMfaAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await disableMfaImpl(prev, fd));
}

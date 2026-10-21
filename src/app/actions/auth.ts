"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { institutes, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { consumeTokens, findValidToken, issueToken } from "@/lib/auth-tokens";
import { AL_GRADE, ADMIN_MIN_PASSWORD, RESET_TOKEN_HOURS, SETUP_TOKEN_HOURS, VERIFY_TOKEN_HOURS } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";
import { clientIp, rateCheck, rateHit, rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { localized } from "@/lib/i18n/server";
import { notifyAdmins } from "@/lib/notify";
import { decryptSecret } from "@/lib/secrets";
import { createSession, destroySession, getCurrentUser, getMfaPendingUser, promoteSession, revokeAllSessions } from "@/lib/session";
import { hashRecoveryCode, verifyTotp } from "@/lib/totp";
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  valuesFrom,
  type FormState,
} from "@/lib/validators";

const TEN_MIN = 10 * 60 * 1000;
const SECRET_FIELDS = ["password", "confirmPassword", "code"];

// Email නොමැති user කෙනෙකුට පවා password check කාලය සමාන කිරීමට
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}

function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/* ------------------------------ Register ------------------------------ */

async function registerActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = valuesFrom(formData, SECRET_FIELDS);
  const ip = await clientIp();

  // එකම IP එකකින් (පන්ති කාමරයක් / ජංගම ජාලයක්) සිසුන් කිහිප දෙනෙක් ලියාපදිංචි විය හැකි නිසා ඉඩ ප්‍රමාණය වැඩියි
  if (!(await rateLimit(`register:${ip}`, 20, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න.", values };
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const d = parsed.data;

  const [institute] = await db
    .select({ id: institutes.id })
    .from(institutes)
    .where(eq(institutes.id, d.instituteId))
    .limit(1);
  if (!institute) {
    return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, d.email))
    .limit(1);
  if (existing) {
    return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් ලියාපදිංචි වී ඇත"] }, values };
  }

  let userId: string;
  try {
    const [created] = await db
      .insert(users)
      .values({
        name: d.name,
        school: d.school,
        grade: d.grade,
        medium: d.medium,
        alYear: d.grade === AL_GRADE ? Number(d.alYear) : null,
        phone: d.phone,
        email: d.email,
        instituteId: d.instituteId,
        // සිසුවා email තහවුරු කළ පසු තමාගේම මුරපදය සාදයි. එතෙක් කිසිවෙකුට නොදන්නා අහඹු මුරපදයක්
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
        role: "STUDENT",
        status: "PENDING",
      })
      .returning({ id: users.id });
    userId = created.id;
    await notifyAdmins("STUDENT_REGISTERED", { name: d.name });
  } catch (e) {
    if (["23505"].includes((e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code ?? "")) {
      return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් ලියාපදිංචි වී ඇත"] }, values };
    }
    console.error("register failed", e);
    return { error: "ලියාපදිංචි වීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }

  let mailFailed = false;
  try {
    const token = await issueToken(userId, "VERIFY_EMAIL", VERIFY_TOKEN_HOURS);
    await sendVerificationEmail(d.email, d.name, token);
  } catch (e) {
    console.error("verification email failed", e);
    mailFailed = true;
  }

  await audit(userId, "student.register", d.email, undefined, userId);
  redirect(
    `/register/check-email?email=${encodeURIComponent(d.email)}${mailFailed ? "&mail=failed" : ""}`,
  );
}

/* ------------------------------- Login -------------------------------- */

async function loginActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = valuesFrom(formData, SECRET_FIELDS);
  const ip = await clientIp();

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const { email, password } = parsed.data;

  // වැරදි උත්සාහ පමණක් ගණන් ගනී (එකම IP එකකින් බොහෝ සිසුන් සාර්ථකව login විය හැක)
  if (!(await rateCheck(`login-ip:${ip}`, 30, TEN_MIN)) || !(await rateCheck(`login-email:${email}`, 6, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න.", values };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await getDummyHash()), false);

  if (!user || !passwordOk) {
    await Promise.all([rateHit(`login-ip:${ip}`, TEN_MIN), rateHit(`login-email:${email}`, TEN_MIN)]);
    await audit(user?.id ?? null, "auth.login_failed", email.slice(0, 150), undefined, user?.id);
    // වැරදි උත්සාහ සීමාවට ළඟා වූ විට ගිණුම තාවකාලිකව අගුලු දැමේ (විනාඩි 10) : එය වරක් පමණක් ලියයි
    if (!(await rateCheck(`login-email:${email}`, 6, TEN_MIN))) {
      if (await rateLimit(`lockout-logged:${email}`, 1, TEN_MIN)) await audit(user?.id ?? null, "auth.lockout", email.slice(0, 150), undefined, user?.id);
    }
    return { error: "Email ලිපිනය හෝ මුරපදය වැරදියි.", values };
  }

  // මුරපදය නිවැරදි නම් පමණක් ගිණුමේ තත්ත්වය පෙන්වයි
  if (!user.emailVerified) {
    return {
      error: "ඔබගේ email ලිපිනය තවමත් තහවුරු කර නැහැ. ලැබුණු email එකේ link එක ඔබන්න.",
      code: "UNVERIFIED",
      values,
    };
  }
  // PENDING (Admin අනුමැතිය බලාපොරොත්තුවෙන්) සිසුන්ට login විය හැක; ඔවුන්ට පෙනෙන්නේ dashboard හි "අනුමැතිය බලාපොරොත්තුවෙන්" පණිවිඩය පමණි
  if (user.status === "SUSPENDED") {
    return {
      error: "ඔබගේ ගිණුම තාවකාලිකව අත්හිටුවා ඇත. වැඩිදුර විස්තර සඳහා ආයතනය අමතන්න.",
      code: "SUSPENDED",
      values,
    };
  }

  await rateLimitReset(`login-email:${email}`); // වැරදි උත්සාහ පමණක් ගණන් ගැනේ
  // 2-step verification සක්‍රිය නම්: මුරපදය නිවැරදි වුවද code එක ඇතුළත් කරන තෙක් ප්‍රවේශයක් නැත
  if (user.mfaEnabledAt && user.mfaSecretEnc) {
    await createSession(user.id, { mfaVerified: false });
    redirect("/login/verify");
  }
  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit(user.id, "auth.login", user.email, undefined, user.id);
  redirect(user.role === "STUDENT" ? "/dashboard" : "/admin");
}

/* ------------------------- 2-step verification (login) ------------------------- */

async function verifyMfaActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const pending = await getMfaPendingUser();
  if (!pending) redirect("/login");
  const ip = await clientIp();
  if (!(await rateCheck(`mfa-user:${pending.id}`, 5, TEN_MIN)) || !(await rateCheck(`mfa-ip:${ip}`, 30, TEN_MIN))) {
    await destroySession();
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත login වන්න." };
  }
  const code = String(formData.get("code") ?? "").trim();
  const [u] = await db.select().from(users).where(eq(users.id, pending.id)).limit(1);
  if (!u?.mfaSecretEnc || !u.mfaEnabledAt || u.status === "SUSPENDED") {
    await destroySession();
    redirect("/login");
  }

  let ok = false;
  let usedRecovery = false;
  const step = verifyTotp(decryptSecret(u.mfaSecretEnc), code, u.mfaLastStep);
  if (step !== null) {
    // atomic: එකම code එක දෙවරක් භාවිතා කළ නොහැක (replay)
    const r = await db
      .update(users)
      .set({ mfaLastStep: step })
      .where(and(eq(users.id, u.id), or(isNull(users.mfaLastStep), lt(users.mfaLastStep, step))))
      .returning({ id: users.id });
    ok = r.length > 0;
  } else if (/^[0-9a-f]{5}-?[0-9a-f]{5}$/i.test(code)) {
    const h = hashRecoveryCode(code);
    const list = u.mfaRecoveryHashes ?? [];
    if (list.includes(h)) {
      const r = await db
        .update(users)
        .set({ mfaRecoveryHashes: list.filter((x) => x !== h) })
        .where(and(eq(users.id, u.id), sql`${users.mfaRecoveryHashes} = ${JSON.stringify(list)}::jsonb`))
        .returning({ id: users.id });
      ok = r.length > 0;
      usedRecovery = ok;
    }
  }

  if (!ok) {
    await Promise.all([rateHit(`mfa-user:${u.id}`, TEN_MIN), rateHit(`mfa-ip:${ip}`, TEN_MIN)]);
    await audit(u.id, "auth.mfa_failed", u.email, undefined, u.id);
    return { fieldErrors: { code: ["Code එක වැරදියි. නැවත උත්සාහ කරන්න."] } };
  }

  await rateLimitReset(`mfa-user:${u.id}`);
  await promoteSession(u.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await audit(u.id, "auth.login", u.email, usedRecovery ? "mfa:recovery" : "mfa", u.id);
  if (usedRecovery) await audit(u.id, "mfa.recovery_used", u.email, String((u.mfaRecoveryHashes?.length ?? 1) - 1), u.id);
  redirect(u.role === "STUDENT" ? "/dashboard" : "/admin");
}

// 2-step පියවරෙන් ඉවත් වී (cancel) session එක අවසන් කරයි
export async function cancelMfaAction() {
  await destroySession();
  redirect("/login");
}

export async function logoutAction() {
  const me = await getCurrentUser();
  if (me) await audit(me.id, "auth.logout", me.email, undefined, me.id);
  await destroySession();
  redirect("/login");
}

/* --------------------------- Email verification ------------------------ */

export async function verifyEmailAction(formData: FormData) {
  const token = formData.get("token")?.toString();
  const row = await findValidToken(token, "VERIFY_EMAIL");
  if (!row) redirect("/verify-email?error=1");

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, row.userId));
  await consumeTokens(row.userId, "VERIFY_EMAIL");
  await audit(row.userId, "student.verify_email", undefined, undefined, row.userId);

  // Email තහවුරු වූ විගස වෙනම තිරයක මුරපදය සාදයි (token එක මුරපද-සැකසීමේ link එක ලෙස ක්‍රියා කරයි)
  const setupToken = await issueToken(row.userId, "RESET_PASSWORD", SETUP_TOKEN_HOURS);
  redirect(`/set-password?token=${setupToken}`);
}

async function resendVerificationActionImpl(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { email } = parsed.data;

  if (!(await rateLimit(`resend-ip:${ip}`, 10, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  }

  // Email ලියාපදිංචි දැයි හෙළි නොකිරීමට සෑම විටම එකම පිළිතුර දෙයි
  const message =
    "ඔබගේ email ලිපිනය ලියාපදිංචි වී ඇත්නම් සහ තවම තහවුරු කර නොමැති නම්, නව link එකක් යවා ඇත.";

  if (await rateLimit(`resend-email:${email}`, 2, TEN_MIN)) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user && !user.emailVerified) {
      try {
        const token = await issueToken(user.id, "VERIFY_EMAIL", VERIFY_TOKEN_HOURS);
        await sendVerificationEmail(user.email, user.name, token);
      } catch (e) {
        console.error("resend verification failed", e);
      }
    }
  }
  return { ok: true, message };
}

/* ----------------------------- Password reset -------------------------- */

async function forgotPasswordActionImpl(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await clientIp();
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { email } = parsed.data;

  if (!(await rateLimit(`forgot-ip:${ip}`, 10, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  }

  const message =
    "ඔබගේ email ලිපිනය ලියාපදිංචි වී ඇත්නම්, මුරපදය වෙනස් කිරීමේ link එකක් යවා ඇත.";

  if (await rateLimit(`forgot-email:${email}`, 2, TEN_MIN)) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      try {
        const token = await issueToken(user.id, "RESET_PASSWORD", RESET_TOKEN_HOURS);
        await sendPasswordResetEmail(user.email, user.name, token);
        await audit(user.id, "auth.password_reset_requested", user.email, undefined, user.id);
      } catch (e) {
        console.error("password reset email failed", e);
      }
    }
  }
  return { ok: true, message };
}

async function resetPasswordActionImpl(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const row = await findValidToken(parsed.data.token, "RESET_PASSWORD");
  if (!row) {
    return { error: "මෙම link එක වලංගු නැහැ හෝ කල් ඉකුත් වී ඇත. නැවත ඉල්ලුම් කරන්න." };
  }

  const [owner] = await db.select({ role: users.role, emailVerified: users.emailVerified }).from(users).where(eq(users.id, row.userId)).limit(1);
  if (owner && owner.role !== "STUDENT" && parsed.data.password.length < ADMIN_MIN_PASSWORD) {
    return { fieldErrors: { password: ["Admin මුරපදය අවම වශයෙන් අක්ෂර 10ක් විය යුතුයි"] } };
  }

  // Email link එකෙන් පැමිණීම තමා email හිමිකම සනාථ කරයි
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), emailVerified: owner?.emailVerified ?? new Date() })
    .where(eq(users.id, row.userId));
  await consumeTokens(row.userId, "RESET_PASSWORD");
  await revokeAllSessions(row.userId); // පරණ sessions සියල්ල අවලංගු කරයි
  await audit(row.userId, "user.password_reset", undefined, undefined, row.userId);
  redirect("/login?reset=1");
}

async function setPasswordActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const row = await findValidToken(parsed.data.token, "RESET_PASSWORD");
  if (!row) {
    return { error: "මෙම link එක වලංගු නැහැ හෝ කල් ඉකුත් වී ඇත. \"මුරපදය අමතකද?\" මගින් නව link එකක් ඉල්ලන්න." };
  }
  const [owner] = await db
    .select({ emailVerified: users.emailVerified, status: users.status, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (!owner?.emailVerified) {
    return { error: "මෙම link එක වලංගු නැහැ හෝ කල් ඉකුත් වී ඇත. \"මුරපදය අමතකද?\" මගින් නව link එකක් ඉල්ලන්න." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(users.id, row.userId));
  await consumeTokens(row.userId, "RESET_PASSWORD");
  await audit(row.userId, "student.set_password", undefined, undefined, row.userId);
  if (owner.role === "STUDENT" && owner.status === "PENDING") await notifyAdmins("STUDENT_READY", { name: owner.name, id: row.userId });
  redirect("/login?created=1");
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function registerAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await registerActionImpl(prev, formData));
}

export async function loginAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await loginActionImpl(prev, formData));
}

export async function verifyMfaAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await verifyMfaActionImpl(prev, formData));
}

export async function resendVerificationAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await resendVerificationActionImpl(prev, formData));
}

export async function forgotPasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await forgotPasswordActionImpl(prev, formData));
}

export async function resetPasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await resetPasswordActionImpl(prev, formData));
}

export async function setPasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await setPasswordActionImpl(prev, formData));
}

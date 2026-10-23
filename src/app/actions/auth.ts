"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { institutes, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { consumeTokens, findValidToken, issueToken } from "@/lib/auth-tokens";
import { OTP_MINUTES, OTP_RESEND_SECONDS } from "@/lib/otp-config";
import { checkEmailOtp, clearEmailOtp, issueEmailOtp, resendWaitSeconds } from "@/lib/email-otp";
import { AL_GRADE, ADMIN_MIN_PASSWORD, RESET_TOKEN_HOURS, SETUP_TOKEN_HOURS, VERIFY_TOKEN_HOURS } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { sendIndexEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";
import { clientIp, rateCheck, rateHit, rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { getT, localized } from "@/lib/i18n/server";
import { releaseExpiredSuspensions } from "@/lib/suspension";
import { formatColombo } from "@/lib/time";
import { notifyAdmins } from "@/lib/notify";
import { decryptSecret } from "@/lib/secrets";
import { clearStaleSession, createSession, destroySession, getCurrentUser, getMfaPendingUser, postLoginPath, promoteSession, rememberNext, revokeAllSessions } from "@/lib/session";
import { hashRecoveryCode, verifyTotp } from "@/lib/totp";
import {
  emailCodeSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  valuesFrom,
  type FormState,
  mfaLoginSchema,
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
  let indexNo = "";
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
      .returning({ id: users.id, indexNo: users.indexNo });
    userId = created.id;
    indexNo = created.indexNo ?? "";
    await notifyAdmins("STUDENT_REGISTERED", { name: d.name });
  } catch (e) {
    if (["23505"].includes((e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code ?? "")) {
      return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් ලියාපදිංචි වී ඇත"] }, values };
    }
    console.error("register failed", e);
    return { error: "ලියාපදිංචි වීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }

  let mailFailed = false;
  let noCode = false;
  let otpExpires = Date.now() + OTP_MINUTES * 60_000;
  let code: string | undefined;
  try {
    const otp = await issueEmailOtp(userId);
    code = otp.code;
    otpExpires = otp.expiresAt.getTime();
  } catch (e) {
    // උදා: `npm run db:migrate` ධාවනය කර නැති විට. Code නොමැතිව වුවත් link එක සහිත email එක යවයි
    console.error("email code could not be issued (did you run `npm run db:migrate`?)", e);
    noCode = true;
  }
  try {
    const token = await issueToken(userId, "VERIFY_EMAIL", VERIFY_TOKEN_HOURS);
    await sendVerificationEmail(d.email, d.name, token, code, indexNo || undefined);
  } catch (e) {
    console.error("verification email failed", e);
    mailFailed = true;
  }

  await audit(userId, "student.register", d.email, undefined, userId);
  redirect(
    `/register/check-email?email=${encodeURIComponent(d.email)}&exp=${otpExpires}${mailFailed ? "&mail=failed" : ""}${noCode ? "&nocode=1" : ""}${indexNo ? `&idx=${encodeURIComponent(indexNo)}` : ""}`,
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
  const { email: ident, password } = parsed.data; // email හෝ Index අංකය

  const [user] = await db
    .select()
    .from(users)
    .where(ident.includes("@") ? eq(users.email, ident) : eq(users.indexNo, ident))
    .limit(1);
  // එකම ගිණුමට email සහ index දෙකෙන්ම උත්සාහ කිරීමෙන් rate limit මග නොහැරීමට, ගිණුමේ email එක යතුර ලෙස ගනී
  const email = user?.email ?? ident;

  // වැරදි උත්සාහ පමණක් ගණන් ගනී (එකම IP එකකින් බොහෝ සිසුන් සාර්ථකව login විය හැක)
  if (!(await rateCheck(`login-ip:${ip}`, 30, TEN_MIN)) || !(await rateCheck(`login-email:${email}`, 6, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න.", values };
  }

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
    return { error: "Email / Index අංකය හෝ මුරපදය වැරදියි.", values };
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
  // කාලය ඉකුත් වූ තාවකාලික අත්හිටුවීමක් ස්වයංක්‍රීයව ඉවත් කරයි
  if (user.status === "SUSPENDED" && user.suspendedUntil && user.suspendedUntil.getTime() <= Date.now()) {
    if ((await releaseExpiredSuspensions(user.id)) > 0) user.status = "ACTIVE";
  }
  if (user.status === "SUSPENDED") {
    const t = await getT();
    const base = user.suspendedUntil
      ? t("ඔබගේ ගිණුම {date} දක්වා තාවකාලිකව අත්හිටුවා ඇත. ඉන් පසු ස්වයංක්‍රීයව නැවත සක්‍රිය වේ.", { date: formatColombo(user.suspendedUntil) })
      : t("ඔබගේ ගිණුම ස්ථිරවම අත්හිටුවා ඇත. වැඩිදුර විස්තර සඳහා ආයතනය අමතන්න.");
    return {
      error: user.suspendReason ? `${base} ${t("හේතුව")}: ${user.suspendReason}` : base,
      code: "SUSPENDED",
      values,
    };
  }

  await rateLimitReset(`login-email:${email}`); // වැරදි උත්සාහ පමණක් ගණන් ගැනේ
  await rememberNext(formData.get("next")); // login වූ පසු මුල් පිටුවටම යවයි (2-step හරහාද)
  // 2-step verification සක්‍රිය නම්: මුරපදය නිවැරදි වුවද code එක ඇතුළත් කරන තෙක් ප්‍රවේශයක් නැත
  if (user.mfaEnabledAt && user.mfaSecretEnc) {
    await createSession(user.id, { mfaVerified: false });
    redirect("/login/verify");
  }
  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit(user.id, "auth.login", user.email, undefined, user.id);
  redirect(await postLoginPath(user.role));
}

/* ------------------------- 2-step verification (login) ------------------------- */

async function verifyMfaActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const pending = await getMfaPendingUser();
  if (!pending) redirect("/login");
  const parsedCode = mfaLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsedCode.success) return { fieldErrors: fieldErrorsOf(parsedCode.error) };
  const ip = await clientIp();
  if (!(await rateCheck(`mfa-user:${pending.id}`, 5, TEN_MIN)) || !(await rateCheck(`mfa-ip:${ip}`, 30, TEN_MIN))) {
    await destroySession();
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත login වන්න." };
  }
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const [u] = await db.select().from(users).where(eq(users.id, pending.id)).limit(1);
  if (!u?.mfaSecretEnc || !u.mfaEnabledAt || u.status === "SUSPENDED") {
    await destroySession();
    redirect("/login");
  }

  let ok = false;
  let usedRecovery = false;
  let secret: string;
  try {
    secret = decryptSecret(u.mfaSecretEnc);
  } catch (e) {
    // APP_SECRET වෙනස් කර ඇත්නම් (හෝ දත්ත විනාශ වී ඇත්නම්) secret එක කියවිය නොහැක
    console.error("2-step secret could not be decrypted (APP_SECRET changed?)", e);
    return { error: "2-step සැකසුම කියවිය නොහැක. Recovery code එකක් භාවිතා කරන්න, නැතහොත් Super Admin ගෙන් 2-step reset කරගන්න." };
  }
  const step = verifyTotp(secret, code, u.mfaLastStep);
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
    // නිවැරදි code එකක් නමුත් දැනටමත් භාවිතා කර ඇත (උදා: 2-step සක්‍රිය කරන විට ඇතුළත් කළ code එකම): වෙනම පණිවිඩයක්
    if (step === null && verifyTotp(secret, code, null) !== null) {
      return { fieldErrors: { code: ["මෙම code එක දැනටමත් භාවිතා කර ඇත. Authenticator app එකේ ඊළඟ code එක එනතෙක් (තත්පර 30ක් පමණ) රැඳී සිට ඒ code එක ඇතුළත් කරන්න."] } };
    }
    return { fieldErrors: { code: ["Code එක වැරදියි. නැවත උත්සාහ කරන්න."] } };
  }

  await rateLimitReset(`mfa-user:${u.id}`);
  await promoteSession(u.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await audit(u.id, "auth.login", u.email, usedRecovery ? "mfa:recovery" : "mfa", u.id);
  if (usedRecovery) await audit(u.id, "mfa.recovery_used", u.email, String((u.mfaRecoveryHashes?.length ?? 1) - 1), u.id);
  redirect(await postLoginPath(u.role));
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
  redirect("/login?reason=logout");
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
  await clearEmailOtp(row.userId);
  await audit(row.userId, "student.verify_email", undefined, undefined, row.userId);

  // Email තහවුරු වූ විගස වෙනම තිරයක මුරපදය සාදයි (token එක මුරපද-සැකසීමේ link එක ලෙස ක්‍රියා කරයි)
  const setupToken = await issueToken(row.userId, "RESET_PASSWORD", SETUP_TOKEN_HOURS);
  redirect(`/set-password?token=${setupToken}`);
}

// Email එකේ ආ ඉලක්කම් 6ක code එකෙන් තහවුරු කිරීම (විනාඩි 10ක් වලංගුයි, උත්සාහ 5ක සීමාවක්)
async function verifyEmailCodeImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = valuesFrom(formData);
  const parsed = emailCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const { email, code } = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimit(`otp-ip:${ip}`, 30, TEN_MIN)) || !(await rateLimit(`otp-email:${email}`, 15, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න.", values };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const result = user && !user.emailVerified ? await checkEmailOtp(user.id, code) : "wrong";
  if (!user || result !== "ok") {
    if (user) await audit(user.id, "auth.email_code_failed", email, result, user.id);
    if (result === "expired") return { error: "Code එක කල් ඉකුත් වී ඇත. අලුත් code එකක් ඉල්ලන්න.", values: { email } };
    if (result === "locked") return { error: "වැරදි උත්සාහ ගණන වැඩියි. අලුත් code එකක් ඉල්ලන්න.", values: { email } };
    return { fieldErrors: { code: ["Code එක වැරදියි. නැවත පරීක්ෂා කර උත්සාහ කරන්න."] }, values: { email } };
  }

  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));
  await consumeTokens(user.id, "VERIFY_EMAIL");
  await audit(user.id, "student.verify_email", undefined, "code", user.id);
  const setupToken = await issueToken(user.id, "RESET_PASSWORD", SETUP_TOKEN_HOURS);
  redirect(`/set-password?token=${setupToken}`);
}

// අලුත් code එකක් ඉල්ලීම (තත්පර 60ක පරතරයක් සහ ගණන් සීමාවක් සහිතව)
async function resendEmailCodeImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: emailCodeSchema.shape.email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { email } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`otp-resend-ip:${ip}`, 12, TEN_MIN)) || !(await rateLimit(`otp-resend-email:${email}`, 5, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  }
  const message = "ඔබගේ email ලිපිනය ලියාපදිංචි වී ඇත්නම් සහ තවම තහවුරු කර නොමැති නම්, අලුත් code එකක් යවා ඇත.";
  let expiresAt = Date.now() + OTP_MINUTES * 60_000;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user && !user.emailVerified) {
    const wait = await resendWaitSeconds(user.id);
    if (wait > 0) return { error: "අලුත් code එකක් ඉල්ලීමට පෙර තත්පර කිහිපයක් රැඳී සිටින්න.", wait };
    try {
      const token = await issueToken(user.id, "VERIFY_EMAIL", VERIFY_TOKEN_HOURS);
      const otp = await issueEmailOtp(user.id);
      expiresAt = otp.expiresAt.getTime();
      await sendVerificationEmail(user.email, user.name, token, otp.code);
      await audit(user.id, "student.resend_verify", user.email, "code", user.id);
    } catch (e) {
      console.error("resend code failed", e);
    }
  }
  return { ok: true, message, expiresAt, wait: OTP_RESEND_SECONDS };
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
        const otp = await issueEmailOtp(user.id);
        await sendVerificationEmail(user.email, user.name, token, otp.code);
      } catch (e) {
        console.error("resend verification failed", e);
      }
    }
  }
  return { ok: true, message, values: { email } };
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

  const [owner] = await db
    .select({ role: users.role, emailVerified: users.emailVerified, lastLoginAt: users.lastLoginAt, name: users.name, email: users.email, indexNo: users.indexNo })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
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
  // Admin / Admin සාදන ලද සිසුවා පළමු වරට මුරපදය සකසන විට (invite flow): ලියාපදිංචිය අවසන් - Index අංකය email කරයි
  const firstTime = !!owner && !owner.lastLoginAt && !!owner.indexNo;
  if (firstTime) {
    try {
      await sendIndexEmail(owner.email, owner.name, owner.indexNo!, owner.role !== "STUDENT");
    } catch (e) {
      console.error("index email failed", e);
    }
  }
  redirect(`/login?reset=1${firstTime ? `&idx=${encodeURIComponent(owner.indexNo!)}` : ""}`);
}

async function setPasswordActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const row = await findValidToken(parsed.data.token, "RESET_PASSWORD");
  if (!row) {
    return { error: "මෙම link එක වලංගු නැහැ හෝ කල් ඉකුත් වී ඇත. \"මුරපදය අමතකද?\" මගින් නව link එකක් ඉල්ලන්න." };
  }
  const [owner] = await db
    .select({ emailVerified: users.emailVerified, status: users.status, role: users.role, name: users.name, email: users.email, indexNo: users.indexNo })
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
  // ලියාපදිංචිය අවසන්: Index අංකය email කරයි
  if (owner.indexNo) {
    try {
      await sendIndexEmail(owner.email, owner.name, owner.indexNo, owner.role !== "STUDENT");
    } catch (e) {
      console.error("index email failed", e);
    }
  }
  redirect(`/login?created=1${owner.indexNo ? `&idx=${encodeURIComponent(owner.indexNo)}` : ""}`);
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function verifyEmailCodeAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await verifyEmailCodeImpl(prev, formData));
}

export async function resendEmailCodeAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await resendEmailCodeImpl(prev, formData));
}

export async function registerAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await registerActionImpl(prev, formData));
}

export async function loginAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await loginActionImpl(prev, formData));
}

export async function verifyMfaAction(prev: FormState, formData: FormData): Promise<FormState> {
  try {
    return localized(await verifyMfaActionImpl(prev, formData));
  } catch (e) {
    unstable_rethrow(e); // redirect() සාමාන්‍ය ලෙස ඉදිරියට යයි
    console.error("verifyMfaAction failed", e);
    return localized({ error: "තහවුරු කිරීම අසාර්ථකයි. නැවත උත්සාහ කරන්න. නැවතත් අසාර්ථක නම් නැවත login වන්න." });
  }
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

// Login පිටුවේදී (client) කැඳවයි: ඉකුත් වූ / අවසන් කළ session cookie එක ඉවත් කරයි. වලංගු session එකක් ඇත්නම් කිසිවක් නොකරයි.
export async function clearStaleSessionAction() {
  await clearStaleSession();
}

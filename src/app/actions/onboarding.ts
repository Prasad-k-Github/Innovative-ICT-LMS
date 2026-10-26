"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { PRIVACY_VERSION } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { checkEmailOtp, clearEmailOtp, issueEmailOtp, resendWaitSeconds } from "@/lib/email-otp";
import { localized } from "@/lib/i18n/server";
import { sendOnboardingCodeEmail } from "@/lib/mail";
import { OTP_RESEND_SECONDS } from "@/lib/otp-config";
import { rateLimit } from "@/lib/rate-limit";
import { requireStudentSetup } from "@/lib/session";
import { emailCodeSchema, emailOnlySchema, onboardingConsentSchema, onboardingPasswordSchema, valuesFrom, type FormState } from "@/lib/validators";

// පළමු login පියවර (Admin සාදන / පැරණි සිසුන් සඳහා): (1) තමන්ගේ මුරපදය (2) Email තහවුරු කිරීම (3) එකඟත්වයන් සහ දෙමාපිය විස්තර.
// සෑම action එකක්ම සිසුවා ලොග් වී ඇති බවත්, සිටින පියවර මෙයම බවත් පරීක්ෂා කරයි.

const TEN_MIN = 10 * 60 * 1000;
const fieldErrorsOf = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

async function setPasswordImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudentSetup();
  if (me.onboardingStep !== "password") redirect("/welcome");
  if (!(await rateLimit(`onb-pass:${me.id}`, 10, TEN_MIN))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  const parsed = onboardingPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const [u] = await db.select({ hash: users.passwordHash, confirmed: users.emailConfirmedAt }).from(users).where(eq(users.id, me.id)).limit(1);
  if (u && (await verifyPassword(parsed.data.password, u.hash))) {
    return { fieldErrors: { password: ["නව මුරපදය තාවකාලික මුරපදයට වඩා වෙනස් විය යුතුයි"] } };
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false, tempPasswordExpiresAt: null })
    .where(eq(users.id, me.id));
  await audit(me.id, "student.set_password", "onboarding", undefined, me.id);
  // ඊළඟ පියවරට පෙර Email code එක ස්වයංක්‍රීයව යවයි (අසාර්ථක වුවහොත් එම පියවරේ "නැවත යවන්න" බොත්තමක් ඇත)
  if (!u?.confirmed) {
    try {
      const otp = await issueEmailOtp(me.id);
      await sendOnboardingCodeEmail(me.email, me.name, otp.code);
    } catch (e) {
      console.error("onboarding code email failed", e);
    }
  }
  redirect("/welcome");
}

async function sendCodeImpl(): Promise<FormState> {
  const me = await requireStudentSetup();
  if (me.onboardingStep !== "email") redirect("/welcome");
  if (!(await rateLimit(`onb-code:${me.id}`, 6, TEN_MIN))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  const wait = await resendWaitSeconds(me.id);
  if (wait > 0) return { error: "අලුත් code එකක් ඉල්ලීමට පෙර තත්පර කිහිපයක් රැඳී සිටින්න.", wait };
  try {
    const otp = await issueEmailOtp(me.id);
    await sendOnboardingCodeEmail(me.email, me.name, otp.code);
    await audit(me.id, "student.onboarding_code_sent", me.email, undefined, me.id);
    revalidatePath("/welcome");
    return { ok: true, message: "Code එක ඔබගේ email ලිපිනයට යවන ලදී.", expiresAt: otp.expiresAt.getTime(), wait: OTP_RESEND_SECONDS };
  } catch (e) {
    console.error("onboarding code email failed", e);
    return { error: "Email යැවීම අසාර්ථකයි. ටික වේලාවකින් නැවත උත්සාහ කරන්න." };
  }
}

async function confirmCodeImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudentSetup();
  if (me.onboardingStep !== "email") redirect("/welcome");
  const values = valuesFrom(formData, ["code"]);
  if (!(await rateLimit(`onb-confirm:${me.id}`, 15, TEN_MIN))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න.", values };
  const parsed = emailCodeSchema.shape.code.safeParse(formData.get("code")?.toString() ?? "");
  if (!parsed.success) return { fieldErrors: { code: [parsed.error.issues[0]?.message ?? "Code එක වැරදියි."] }, values };
  const result = await checkEmailOtp(me.id, parsed.data);
  if (result === "expired") return { error: "Code එක කල් ඉකුත් වී ඇත. අලුත් code එකක් ඉල්ලන්න.", values };
  if (result === "locked") return { error: "වැරදි උත්සාහ ගණන වැඩියි. අලුත් code එකක් ඉල්ලන්න.", values };
  if (result !== "ok") {
    await audit(me.id, "auth.email_code_failed", me.email, "onboarding", me.id);
    return { fieldErrors: { code: ["Code එක වැරදියි. නැවත පරීක්ෂා කර උත්සාහ කරන්න."] }, values };
  }
  const now = new Date();
  await db.update(users).set({ emailConfirmedAt: now, emailVerified: now }).where(eq(users.id, me.id));
  await audit(me.id, "student.verify_email", undefined, "onboarding", me.id);
  redirect("/welcome");
}

// Admin ඇතුළත් කළ email ලිපිනය වැරදි නම් සිසුවාට නිවැරදි කර නව code එකක් ලබා ගත හැක
async function changeEmailImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudentSetup();
  if (me.onboardingStep !== "email") redirect("/welcome");
  const values = valuesFrom(formData);
  if (!(await rateLimit(`onb-email-change:${me.id}`, 5, 60 * 60_000))) return { error: "උත්සාහ ගණන වැඩියි. පසුව නැවත උත්සාහ කරන්න.", values };
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const email = parsed.data.email;
  if (email === me.email) return { fieldErrors: { email: ["මෙය දැනටමත් ඔබගේ email ලිපිනයයි"] }, values };
  const [dup] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, me.id))).limit(1);
  if (dup) return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };
  try {
    await db.update(users).set({ email, emailConfirmedAt: null }).where(eq(users.id, me.id));
  } catch {
    return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };
  }
  await clearEmailOtp(me.id);
  await audit(me.id, "student.email_change", email, "onboarding", me.id);
  try {
    const otp = await issueEmailOtp(me.id);
    await sendOnboardingCodeEmail(email, me.name, otp.code);
  } catch (e) {
    console.error("onboarding code email failed", e);
  }
  revalidatePath("/welcome");
  return { ok: true, message: "Email ලිපිනය යාවත්කාලීන කර නව code එකක් යවන ලදී." };
}

async function saveConsentImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudentSetup();
  if (me.onboardingStep !== "consent") redirect("/welcome");
  const values = valuesFrom(formData);
  const parsed = onboardingConsentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const [cur] = await db.select({ parentEmail: users.parentEmail }).from(users).where(eq(users.id, me.id)).limit(1);
  const now = new Date();
  await db
    .update(users)
    .set({
      parentPhone: d.parentPhone,
      parentEmail: d.parentEmail || null,
      // වෙනත් Email ලිපිනයක් නම් පෙර unsubscribe එක අදාළ නොවේ
      ...((cur?.parentEmail ?? "") !== d.parentEmail ? { parentUnsubscribedAt: null } : {}),
      parentOptInAt: now,
      consentAt: now,
      consentVersion: PRIVACY_VERSION,
    })
    .where(eq(users.id, me.id));
  await audit(me.id, "student.onboarding_complete", PRIVACY_VERSION, undefined, me.id);
  redirect("/dashboard");
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function setOnboardingPasswordAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await setPasswordImpl(prev, fd));
}
export async function sendOnboardingCodeAction(): Promise<FormState> {
  return localized(await sendCodeImpl());
}
export async function confirmOnboardingEmailAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await confirmCodeImpl(prev, fd));
}
export async function changeOnboardingEmailAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await changeEmailImpl(prev, fd));
}
export async function saveOnboardingConsentAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await saveConsentImpl(prev, fd));
}

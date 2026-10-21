"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { changeRequests, institutes, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { AL_GRADE, ADMIN_MIN_PASSWORD } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { localized } from "@/lib/i18n/server";
import { notifyAdmins } from "@/lib/notify";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { createSession, destroySession, requireStudent, requireUser, revokeAllSessions } from "@/lib/session";
import {
  changePasswordSchema,
  changeRequestSchema,
  deleteAccountSchema,
  profileSchema,
  valuesFrom,
  type FormState,
} from "@/lib/validators";

// සිසුවාට තමාගේම ගිණුම මත පමණක් ක්‍රියා කළ හැක. id සෑම විටම session එකෙන් ගනී (form එකෙන් නොවේ).

const TEN_MIN = 10 * 60 * 1000;

function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/* ------------------------------ විස්තර සංස්කරණය ------------------------------ */

async function updateProfileImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudent();
  const values = valuesFrom(formData);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  await db.update(users).set(parsed.data).where(eq(users.id, me.id));
  await audit(me.id, "student.update_profile", me.email, undefined, me.id);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "විස්තර සුරැකිණි.", values: { ...values, phone: parsed.data.phone } };
}

/* ------------------------------ මුරපදය වෙනස් කිරීම ------------------------------ */

async function changePasswordImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser(); // සිසුන් සහ Admin ලා දෙපිරිසටම (තමාගේම මුරපදය පමණි)
  if (!(await rateLimit(`chpw:${me.id}`, 6, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  }
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  // Admin ගිණුම් සඳහා වඩා ශක්තිමත් මුරපදයක් (සියලු දත්ත වලට ප්‍රවේශය ඇති නිසා)
  if (me.role !== "STUDENT" && parsed.data.password.length < ADMIN_MIN_PASSWORD) {
    return { fieldErrors: { password: ["Admin මුරපදය අවම වශයෙන් අක්ෂර 10ක් විය යුතුයි"] } };
  }

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.hash))) {
    return { fieldErrors: { currentPassword: ["වත්මන් මුරපදය වැරදියි"] } };
  }
  if (parsed.data.currentPassword === parsed.data.password) {
    return { fieldErrors: { password: ["නව මුරපදය වත්මන් මුරපදයට වඩා වෙනස් විය යුතුයි"] } };
  }

  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, me.id));
  // අනෙක් සියලු උපාංග logout කර, මෙම උපාංගයට අලුත් session එකක් දෙයි
  await revokeAllSessions(me.id);
  await createSession(me.id);
  await rateLimitReset(`chpw:${me.id}`);
  await audit(me.id, "user.password_change", me.email, undefined, me.id);
  return { ok: true, message: "මුරපදය වෙනස් කරන ලදී. අනෙක් උපාංගවල ඔබ logout කරන ලදී." };
}

/* ------------------------------ ගිණුම මකා දැමීම ------------------------------ */

async function deleteAccountImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudent();
  if (!(await rateLimit(`delacct:${me.id}`, 5, TEN_MIN))) {
    return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  }
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.password, row.hash))) {
    return { fieldErrors: { password: ["මුරපදය වැරදියි"] } };
  }

  await audit(me.id, "student.delete_self", me.email, undefined, me.id);
  await db.delete(users).where(and(eq(users.id, me.id), eq(users.role, "STUDENT")));
  await notifyAdmins("STUDENT_DELETED_SELF", { name: me.name });
  await destroySession();
  redirect("/?deleted=1");
}

/* ------------------- ශ්‍රේණිය / මාධ්‍යය / ආයතනය වෙනස් කිරීමේ ඉල්ලීම ------------------- */

async function requestChangeImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudent();
  const values = valuesFrom(formData);
  const parsed = changeRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const alYear = d.grade === AL_GRADE ? Number(d.alYear) : null;

  const [inst] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, d.instituteId)).limit(1);
  if (!inst) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };

  const same =
    d.grade === me.grade && alYear === me.alYear && d.medium === me.medium && d.instituteId === me.instituteId;
  if (same) return { error: "වත්මන් අගයන්ම තෝරා ඇත. වෙනස් කිරීමට අවශ්‍ය දෙය තෝරන්න.", values };

  try {
    await db.insert(changeRequests).values({
      userId: me.id,
      grade: d.grade,
      alYear,
      medium: d.medium,
      instituteId: d.instituteId,
      note: d.note || null,
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "ඔබට දැනටමත් අනුමැතිය බලාපොරොත්තුවෙන් ඉල්ලීමක් ඇත.", values };
    throw e;
  }
  await audit(me.id, "student.request_change", me.email, undefined, me.id);
  await notifyAdmins("CHANGE_REQUEST_NEW", { name: me.name });
  revalidatePath("/dashboard/profile");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "ඉල්ලීම යවන ලදී. Admin අනුමත කළ පසු වෙනස්කම් ක්‍රියාත්මක වේ." };
}

export async function cancelRequestAction() {
  const me = await requireStudent();
  await db.delete(changeRequests).where(and(eq(changeRequests.userId, me.id), eq(changeRequests.status, "PENDING")));
  await audit(me.id, "student.cancel_request", me.email, undefined, me.id);
  revalidatePath("/dashboard/profile");
  revalidatePath("/admin", "layout");
  redirect("/dashboard/profile?notice=cancelled");
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function updateProfileAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateProfileImpl(prev, fd));
}
export async function changePasswordAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await changePasswordImpl(prev, fd));
}
export async function deleteAccountAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await deleteAccountImpl(prev, fd));
}
export async function requestChangeAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await requestChangeImpl(prev, fd));
}

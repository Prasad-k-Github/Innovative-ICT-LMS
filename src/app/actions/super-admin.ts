"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { issueToken } from "@/lib/auth-tokens";
import { INVITE_TOKEN_HOURS } from "@/lib/constants";
import { hashPassword } from "@/lib/crypto";
import { isUniqueViolation } from "@/lib/db-errors";
import { localized } from "@/lib/i18n/server";
import { sendInviteEmail } from "@/lib/mail";
import { requireAdmin, requireSuperAdmin } from "@/lib/session";
import { adminUserSchema, ownNameSchema, valuesFrom, type FormState } from "@/lib/validators";

// Admin ලා කළමනාකරණය: Super Admin (ගුරුවරයා) පමණි. සෑම action එකක්ම requireSuperAdmin() සමඟ
// නැවත පරීක්ෂා කරයි, සහ role = ADMIN ගිණුම් මත පමණක් ක්‍රියා කරයි (Super Admin ගිණුමට කිසිදා බලපාන්නේ නැත).

function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function withParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://local");
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}

const isAdminTarget = (id: string) => and(eq(users.id, id), eq(users.role, "ADMIN"));

/* ------------------------------ Admin කෙනෙකු සෑදීම ------------------------------ */

async function createAdminImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  const values = valuesFrom(formData);
  const parsed = adminUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (dup) return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };

  let id: string;
  try {
    const [created] = await db
      .insert(users)
      .values({
        name: d.name,
        school: "-",
        grade: 0,
        phone: "-",
        email: d.email,
        role: "ADMIN", // මෙතැනින් සෑදිය හැක්කේ සාමාන්‍ය Admin පමණි
        status: "ACTIVE",
        emailVerified: new Date(),
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      })
      .returning({ id: users.id });
    id = created.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };
    console.error("create admin failed", e);
    return { error: "Admin සෑදීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }

  let mailFailed = false;
  try {
    const token = await issueToken(id, "RESET_PASSWORD", INVITE_TOKEN_HOURS);
    await sendInviteEmail(d.email, d.name, token);
  } catch (e) {
    console.error("admin invite email failed", e);
    mailFailed = true;
  }
  await audit(me.id, "admin.create", d.email, undefined, id);
  revalidatePath("/admin", "layout");
  redirect(`/admin/admins/${id}?notice=${mailFailed ? "created-nomail" : "created"}`);
}

/* ------------------------------ Admin කෙනෙකු සංස්කරණය ------------------------------ */

async function updateAdminImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = adminUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const [current] = await db.select().from(users).where(isAdminTarget(id)).limit(1);
  if (!current) return { error: "Admin හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };

  try {
    await db.update(users).set({ name: d.name, email: d.email }).where(eq(users.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { email: ["මෙම email ලිපිනය වෙනත් ගිණුමකට අයිතිය"] }, values };
    console.error("update admin failed", e);
    return { error: "සුරැකීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }
  if (current.email !== d.email) await db.delete(sessions).where(eq(sessions.userId, id));
  await audit(me.id, "admin.update", d.email, undefined, id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

/* ----------------------- අත්හිටුවීම / නැවත සක්‍රිය / මකා දැමීම ----------------------- */

export async function adminOpAction(op: string, id: string) {
  const me = await requireSuperAdmin();
  if (!["suspend", "activate", "delete"].includes(op)) return;
  const back = `/admin/admins/${id}`;

  const [target] = await db.select().from(users).where(isAdminTarget(id)).limit(1);
  if (!target) redirect(withParam("/admin/admins", "notice", "gone"));

  if (op === "delete") {
    await db.delete(users).where(isAdminTarget(id)); // sessions cascade වේ
  } else {
    await db.update(users).set({ status: op === "suspend" ? "SUSPENDED" : "ACTIVE" }).where(isAdminTarget(id));
    if (op === "suspend") await db.delete(sessions).where(eq(sessions.userId, id));
  }
  await audit(me.id, `admin.${op}`, target.email, undefined, id);
  revalidatePath("/admin", "layout");
  redirect(op === "delete" ? withParam("/admin/admins", "notice", "deleted") : withParam(back, "notice", op === "suspend" ? "suspended" : "activated"));
}

// Admin කෙනෙකුගේ 2-step verification නැති කරයි (දුරකථනය නැති වූ විට). සියලු sessions ද අවසන් වේ. Super Admin පමණි.
export async function resetAdminMfaAction(id: string) {
  const me = await requireSuperAdmin();
  const [target] = await db.select().from(users).where(isAdminTarget(id)).limit(1);
  if (!target) redirect(withParam("/admin/admins", "notice", "gone"));
  await db
    .update(users)
    .set({ mfaSecretEnc: null, mfaEnabledAt: null, mfaRecoveryHashes: null, mfaLastStep: null })
    .where(isAdminTarget(id));
  await db.delete(sessions).where(eq(sessions.userId, id));
  await audit(me.id, "mfa.reset_by_admin", target.email, undefined, id);
  redirect(withParam(`/admin/admins/${id}`, "notice", "mfa-reset"));
}

export async function resendAdminInviteAction(id: string) {
  const me = await requireSuperAdmin();
  const [u] = await db.select().from(users).where(isAdminTarget(id)).limit(1);
  if (!u) redirect(withParam("/admin/admins", "notice", "gone"));
  const back = `/admin/admins/${id}`;
  if (u.lastLoginAt) redirect(withParam(back, "notice", "mail-skipped"));

  let ok = true;
  try {
    const token = await issueToken(u.id, "RESET_PASSWORD", INVITE_TOKEN_HOURS);
    await sendInviteEmail(u.email, u.name, token);
  } catch (e) {
    console.error("admin resend invite failed", e);
    ok = false;
  }
  await audit(me.id, "admin.resend_invite", u.email, undefined, u.id);
  redirect(withParam(back, "notice", ok ? "mail-sent" : "mail-failed"));
}

/* ------------------------- Admin ගේම නම සංස්කරණය ------------------------- */

async function updateOwnNameImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const values = valuesFrom(formData);
  const parsed = ownNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, me.id));
  await audit(me.id, "admin.update_self", me.email, undefined, me.id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "විස්තර සුරැකිණි.", values };
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function createAdminAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await createAdminImpl(prev, fd));
}
export async function updateAdminAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateAdminImpl(prev, fd));
}
export async function updateOwnNameAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateOwnNameImpl(prev, fd));
}

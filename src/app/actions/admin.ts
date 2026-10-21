"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { changeRequests, institutes, sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { issueToken } from "@/lib/auth-tokens";
import { AL_GRADE, INVITE_TOKEN_HOURS, VERIFY_TOKEN_HOURS } from "@/lib/constants";
import { hashPassword } from "@/lib/crypto";
import { sendApprovalEmail, sendInviteEmail, sendVerificationEmail } from "@/lib/mail";
import { notifyUsers } from "@/lib/notify";
import { localized } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import {
  adminStudentSchema,
  instituteNameSchema,
  valuesFrom,
  type FormState,
} from "@/lib/validators";

// සටහන: Server Actions public endpoints වේ. එබැවින් සෑම action එකකම
// requireAdmin() සමඟ Admin බව නැවත පරීක්ෂා කරයි. සිසුන් (role = STUDENT) මත පමණක් ක්‍රියා කරයි.
// Admin ට සිසුන්ගේ මුරපද බැලීමට හෝ වෙනස් කිරීමට ක්‍රමයක් නැත.

/* ----------------------------- helpers ----------------------------- */

// ආපසු යන path එක අභ්‍යන්තර /admin පිටුවක් පමණක් විය හැක (open redirect වැළැක්වීමට)
function safeReturn(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || value.includes("\\") || value.includes("//")) return fallback;
  return value === "/admin" || value.startsWith("/admin/") || value.startsWith("/admin?") ? value : fallback;
}

function withParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://local");
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}

function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

// drizzle නව අනුවාද වල pg error එක `cause` තුළ ඇත
function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

const SECRET_KEYS = ["id"];

/* --------------------- සිසුන්: අනුමත / අත්හිටුවීම / මකා දැමීම --------------------- */

const OPS = ["approve", "activate", "suspend", "delete"] as const;

// Bulk (තෝරාගත් සියල්ල: name="ids") හෝ තනි (name="single") ක්‍රියා සඳහා.
// op එක `formAction={studentsAction.bind(null, "suspend")}` ලෙස බැඳ ඇත.
export async function studentsAction(op: string, formData: FormData) {
  const admin = await requireAdmin();
  if (!(OPS as readonly string[]).includes(op)) return;

  const single = formData.get("single")?.toString();
  const ids = single ? [single] : formData.getAll("ids").map(String).filter(Boolean);
  const returnTo = safeReturn(formData.get("returnTo"), "/admin/students");
  if (ids.length === 0) redirect(withParam(returnTo, "notice", "none"));

  const target = and(inArray(users.id, ids), eq(users.role, "STUDENT"));
  let affected: { id: string; email: string; name: string }[] = [];

  if (op === "approve") {
    affected = await db
      .update(users)
      .set({ status: "ACTIVE" })
      .where(and(target, eq(users.status, "PENDING")))
      .returning({ id: users.id, email: users.email, name: users.name });
  } else if (op === "activate") {
    affected = await db
      .update(users)
      .set({ status: "ACTIVE" })
      .where(and(target, eq(users.status, "SUSPENDED")))
      .returning({ id: users.id, email: users.email, name: users.name });
  } else if (op === "suspend") {
    affected = await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(and(target, eq(users.status, "ACTIVE")))
      .returning({ id: users.id, email: users.email, name: users.name });
    // අත්හිටුවූ විගස පවතින sessions සියල්ල අවලංගු කරයි
    if (affected.length) {
      await db.delete(sessions).where(
        inArray(
          sessions.userId,
          affected.map((a) => a.id),
        ),
      );
    }
  } else {
    affected = await db
      .delete(users)
      .where(target)
      .returning({ id: users.id, email: users.email, name: users.name });
  }

  if (affected.length) {
    for (const a of affected) await audit(admin.id, `student.${op}`, a.email, undefined, a.id);
    if (op === "approve") {
      // සිසුවාට app තුළ දැනුම්දීමක් සහ Email එකක් (Email අසාර්ථක වුවද අනුමැතිය පවතී)
      await notifyUsers(affected.map((a) => a.id), "ACCOUNT_APPROVED");
      await Promise.all(
        affected.map(async (a) => {
          try {
            await sendApprovalEmail(a.email, a.name);
          } catch (e) {
            console.error("approval email failed", e);
          }
        }),
      );
    } else if (op === "activate") {
      await notifyUsers(affected.map((a) => a.id), "ACCOUNT_REACTIVATED");
    }
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(returnTo, "notice", `${op}.${affected.length}`));
}

// තනි පේළියක ක්‍රියා: id එක action එකට බැඳ ඇත (button name/value මත රඳා නොසිටී)
export async function studentOneAction(op: string, id: string, formData: FormData) {
  await requireAdmin();
  formData.set("single", id);
  return studentsAction(op, formData);
}

/* --------------------------- සිසුවෙකු සෑදීම --------------------------- */

async function createStudentActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, SECRET_KEYS);

  const parsed = adminStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const [inst] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, d.instituteId)).limit(1);
  if (!inst) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };

  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (dup) return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };

  let id: string;
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
        role: "STUDENT",
        status: "ACTIVE",
        emailVerified: new Date(), // Admin විසින් තහවුරු කරන ලද ගිණුමක්
        // කිසිවෙකුට නොදන්නා අහඹු මුරපදයක්. සිසුවා email link එකෙන් තමාගේම මුරපදය සකසයි
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      })
      .returning({ id: users.id });
    id = created.id;
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };
    }
    console.error("create student failed", e);
    return { error: "සිසුවා සෑදීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }

  let mailFailed = false;
  try {
    const token = await issueToken(id, "RESET_PASSWORD", INVITE_TOKEN_HOURS);
    await sendInviteEmail(d.email, d.name, token);
  } catch (e) {
    console.error("invite email failed", e);
    mailFailed = true;
  }

  await audit(admin.id, "student.create", d.email, undefined, id);
  revalidatePath("/admin", "layout");
  redirect(`/admin/students/${id}?notice=${mailFailed ? "created-nomail" : "created"}`);
}

/* --------------------------- සිසුවෙකු සංස්කරණය --------------------------- */

async function updateStudentActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, SECRET_KEYS);
  const id = formData.get("id")?.toString() ?? "";

  const parsed = adminStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const [current] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "STUDENT")))
    .limit(1);
  if (!current) return { error: "සිසුවා හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };

  const [inst] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, d.instituteId)).limit(1);
  if (!inst) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };

  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, d.email), ne(users.id, id)))
    .limit(1);
  if (dup) return { fieldErrors: { email: ["මෙම email ලිපිනය වෙනත් ගිණුමකට අයිතිය"] }, values };

  try {
    await db
      .update(users)
      .set({
        name: d.name,
        school: d.school,
        grade: d.grade,
        medium: d.medium,
        alYear: d.grade === AL_GRADE ? Number(d.alYear) : null,
        phone: d.phone,
        email: d.email,
        instituteId: d.instituteId,
      })
      .where(eq(users.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { fieldErrors: { email: ["මෙම email ලිපිනය වෙනත් ගිණුමකට අයිතිය"] }, values };
    }
    console.error("update student failed", e);
    return { error: "සුරැකීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }

  // Email වෙනස් වූ විට පවතින sessions අවලංගු කරයි (නව email එකෙන් නැවත login විය යුතුයි)
  if (current.email !== d.email) {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  await audit(admin.id, "student.update", d.email, undefined, id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

/* ------------------------ Email නැවත යැවීම (Admin) ------------------------ */

export async function resendEmailAction(kind: string, formData: FormData) {
  const admin = await requireAdmin();
  if (kind !== "verify" && kind !== "invite") return;
  const id = formData.get("single")?.toString() ?? "";
  const back = `/admin/students/${id}`;

  const [u] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "STUDENT")))
    .limit(1);
  if (!u) redirect("/admin/students");

  let ok = true;
  try {
    if (kind === "verify" && !u.emailVerified) {
      const token = await issueToken(u.id, "VERIFY_EMAIL", VERIFY_TOKEN_HOURS);
      await sendVerificationEmail(u.email, u.name, token);
    } else if (kind === "invite" && u.emailVerified && !u.lastLoginAt) {
      const token = await issueToken(u.id, "RESET_PASSWORD", INVITE_TOKEN_HOURS);
      await sendInviteEmail(u.email, u.name, token);
    } else {
      redirect(withParam(back, "notice", "mail-skipped"));
    }
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("admin resend email failed", e);
    ok = false;
  }
  await audit(admin.id, `student.resend_${kind}`, u.email, undefined, u.id);
  redirect(withParam(back, "notice", ok ? "mail-sent" : "mail-failed"));
}

/* ---------------- සිසුන්ගේ වෙනස් කිරීමේ ඉල්ලීම් (ශ්‍රේණිය / මාධ්‍යය / ආයතනය) ---------------- */

export async function decideRequestAction(op: string, id: string) {
  const admin = await requireAdmin();
  if (op !== "approve" && op !== "reject") return;

  const [req] = await db
    .select()
    .from(changeRequests)
    .where(and(eq(changeRequests.id, id), eq(changeRequests.status, "PENDING")))
    .limit(1);
  if (!req) redirect("/admin/requests?notice=gone");

  if (op === "approve") {
    const [inst] = req.instituteId
      ? await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, req.instituteId)).limit(1)
      : [];
    await db
      .update(users)
      .set({
        grade: req.grade,
        alYear: req.grade === AL_GRADE ? req.alYear : null,
        medium: req.medium,
        ...(inst ? { instituteId: inst.id } : {}),
      })
      .where(and(eq(users.id, req.userId), eq(users.role, "STUDENT")));
  }
  await db
    .update(changeRequests)
    .set({ status: op === "approve" ? "APPROVED" : "REJECTED", decidedAt: new Date() })
    .where(eq(changeRequests.id, id));

  await notifyUsers([req.userId], op === "approve" ? "REQUEST_APPROVED" : "REQUEST_REJECTED");
  await audit(admin.id, `request.${op}`, undefined, undefined, req.userId);
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/requests?notice=${op === "approve" ? "approved" : "rejected"}`);
}

/* ------------------------------- ආයතන ------------------------------- */

const INSTITUTES_PATH = "/admin/institutes";

export async function createInstituteAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = instituteNameSchema.safeParse(formData.get("name")?.toString() ?? "");
  if (!parsed.success) redirect(withParam(`${INSTITUTES_PATH}?tab=add`, "error", parsed.error.issues[0].message));

  try {
    await db.insert(institutes).values({ name: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) {
      redirect(withParam(`${INSTITUTES_PATH}?tab=add`, "error", "මෙම නමින් ආයතනයක් දැනටමත් ඇත"));
    }
    throw e;
  }
  await audit(admin.id, "institute.create", parsed.data);
  revalidatePath("/admin", "layout");
  redirect(withParam(INSTITUTES_PATH, "notice", "created"));
}

export async function renameInstituteAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  const parsed = instituteNameSchema.safeParse(formData.get("name")?.toString() ?? "");
  if (!parsed.success) redirect(withParam(INSTITUTES_PATH, "error", parsed.error.issues[0].message));

  try {
    await db.update(institutes).set({ name: parsed.data }).where(eq(institutes.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) {
      redirect(withParam(INSTITUTES_PATH, "error", "මෙම නමින් ආයතනයක් දැනටමත් ඇත"));
    }
    throw e;
  }
  await audit(admin.id, "institute.rename", parsed.data);
  revalidatePath("/admin", "layout");
  redirect(withParam(INSTITUTES_PATH, "notice", "renamed"));
}

export async function deleteInstituteAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";

  const [inUse] = await db.select({ id: users.id }).from(users).where(eq(users.instituteId, id)).limit(1);
  if (inUse) {
    redirect(withParam(INSTITUTES_PATH, "error", "සිසුන් සිටින ආයතනයක් මකා දැමිය නොහැක"));
  }
  const [gone] = await db.delete(institutes).where(eq(institutes.id, id)).returning({ name: institutes.name });
  if (gone) await audit(admin.id, "institute.delete", gone.name);
  revalidatePath("/admin", "layout");
  redirect(withParam(INSTITUTES_PATH, "notice", "deleted"));
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function createStudentAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await createStudentActionImpl(prev, formData));
}

export async function updateStudentAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await updateStudentActionImpl(prev, formData));
}

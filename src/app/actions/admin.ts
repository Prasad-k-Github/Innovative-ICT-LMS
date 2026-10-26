"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { changeRequests, institutes, sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { issueToken } from "@/lib/auth-tokens";
import { AL_GRADE, VERIFY_TOKEN_HOURS, alExamYears } from "@/lib/constants";
import { hashPassword } from "@/lib/crypto";
import { sendApprovalEmail, sendVerificationEmail } from "@/lib/mail";
import { generateTempPassword, tempPasswordExpiry } from "@/lib/onboarding";
import { notifyUsers } from "@/lib/notify";
import { parseSuspension, releaseExpiredSuspensions } from "@/lib/suspension";
import { formatColombo } from "@/lib/time";
import { getT, localized } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendWeeklySummaries } from "@/lib/parent-summary";
import { PROMOTABLE_GRADES, type PromoteState } from "@/lib/promotion";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, readImportCsv, type ImportRowResult, type ImportState } from "@/lib/student-import";
import { requireAdmin, requireSuperAdmin } from "@/lib/session";
import {
  adminCreateStudentSchema,
  adminStudentSchema,
  instituteNameSchema,
  parentContactSchema,
  parseInstituteCode,
  valuesFrom,
  type FormState,
  type TempCredential,
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
  let suspendDetail: string | undefined;
  let suspendKind = "";

  if (op === "approve") {
    affected = await db
      .update(users)
      .set({ status: "ACTIVE" })
      .where(and(target, eq(users.status, "PENDING")))
      .returning({ id: users.id, email: users.email, name: users.name });
  } else if (op === "activate") {
    affected = await db
      .update(users)
      .set({ status: "ACTIVE", suspendedUntil: null, suspendReason: null, suspendedAt: null })
      .where(and(target, eq(users.status, "SUSPENDED")))
      .returning({ id: users.id, email: users.email, name: users.name });
  } else if (op === "suspend") {
    // තාවකාලික (දින / දිනයක් දක්වා) හෝ ස්ථිර; දැනටමත් අත්හිටුවා ඇති සිසුන්ගේ කාලය / හේතුව යාවත්කාලීන කළ හැක
    const sus = parseSuspension(formData);
    if (!sus.ok) redirect(withParam(returnTo, "error", sus.error));
    const v = sus.value;
    await releaseExpiredSuspensions();
    affected = await db
      .update(users)
      .set({ status: "SUSPENDED", suspendedUntil: v.until, suspendReason: v.reason, suspendedAt: new Date() })
      .where(and(target, inArray(users.status, ["ACTIVE", "SUSPENDED"])))
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
    suspendDetail = `${v.until ? `until ${formatColombo(v.until)}` : "permanent"}${v.reason ? ` · ${v.reason}` : ""}`;
    suspendKind = v.until ? "temp" : "perm";
  } else {
    affected = await db
      .delete(users)
      .where(target)
      .returning({ id: users.id, email: users.email, name: users.name });
  }

  if (affected.length) {
    for (const a of affected) await audit(admin.id, `student.${op}`, a.email, suspendDetail, a.id);
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
  redirect(withParam(returnTo, "notice", op === "suspend" && affected.length ? `suspend-${suspendKind}.${affected.length}` : `${op}.${affected.length}`));
}

// තනි පේළියක ක්‍රියා: id එක action එකට බැඳ ඇත (button name/value මත රඳා නොසිටී)
export async function studentOneAction(op: string, id: string, formData: FormData) {
  await requireAdmin();
  formData.set("single", id);
  return studentsAction(op, formData);
}

/* --------------------------- සිසුවෙකු සෑදීම --------------------------- */

const fmtDate = (d: Date) => formatColombo(d);

async function createStudentActionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, SECRET_KEYS);

  const parsed = adminCreateStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const [inst] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, d.instituteId)).limit(1);
  if (!inst) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };

  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (dup) return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };

  // තාවකාලික මුරපදය: hash පමණක් ගබඩා වේ; සාමාන්‍ය පෙළ Admin ට මෙම වතාවේ පමණක් පෙන්වයි (Email නොකරයි)
  const temp = generateTempPassword();
  const expires = tempPasswordExpiry();
  let credential: TempCredential;
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
        parentPhone: d.parentPhone,
        parentEmail: d.parentEmail || null,
        role: "STUDENT",
        status: "ACTIVE",
        emailVerified: new Date(), // Admin විසින් ඇතුළත් කළ ගිණුමකි; සිසුවා පළමු login එකේදී Email code එකෙන් තහවුරු කරයි (emailConfirmedAt)
        passwordHash: await hashPassword(temp),
        mustChangePassword: true,
        tempPasswordExpiresAt: expires,
      })
      .returning({ id: users.id, indexNo: users.indexNo });
    credential = { id: created.id, name: d.name, email: d.email, indexNo: created.indexNo ?? "", password: temp, expires: fmtDate(expires) };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { fieldErrors: { email: ["මෙම email ලිපිනය දැනටමත් භාවිතා වේ"] }, values };
    }
    console.error("create student failed", e);
    return { error: "සිසුවා සෑදීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.", values };
  }

  await audit(admin.id, "student.create", d.email, undefined, credential.id);
  revalidatePath("/admin", "layout");
  return { ok: true, credential };
}

// තාවකාලික මුරපදය නැවත ජනනය කිරීම (සිසුවා මුරපදය අමතක කළ / පළමු login එකට පෙර මුරපදය නැති වූ විට)
export async function resetTempPasswordAction(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin();
  if (!(await rateLimit(`temp-reset:${admin.id}`, 30, 60 * 60_000))) return localized({ error: "උත්සාහ ගණන වැඩියි. පසුව නැවත උත්සාහ කරන්න." });
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email, indexNo: users.indexNo })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "STUDENT")))
    .limit(1);
  if (!u) return localized({ error: "සිසුවා හමු නොවීය (ඉවත් කර ඇති විය හැක)." });
  const temp = generateTempPassword();
  const expires = tempPasswordExpiry();
  await db.update(users).set({ passwordHash: await hashPassword(temp), mustChangePassword: true, tempPasswordExpiresAt: expires }).where(eq(users.id, id));
  await db.delete(sessions).where(eq(sessions.userId, id)); // පැරණි devices වල logout
  await audit(admin.id, "student.temp_password_reset", u.email, undefined, id);
  revalidatePath("/admin", "layout");
  return { ok: true, credential: { id, name: u.name, email: u.email, indexNo: u.indexNo ?? "", password: temp, expires: fmtDate(expires) } };
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
        // Email ලිපිනය වෙනස් වූ විට සිසුවා නැවත Email code එකෙන් තහවුරු කළ යුතුයි
        ...(current.email !== d.email ? { emailConfirmedAt: null } : {}),
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
  if (kind !== "verify") return;
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

  const code = parseInstituteCode(formData.get("code"));
  if (!code.ok) redirect(withParam(`${INSTITUTES_PATH}?tab=add`, "error", code.error));

  try {
    // කේතය හිස් නම් DB trigger එක නමෙන් සාදයි
    await db.insert(institutes).values({ name: parsed.data, code: code.code ?? "" });
  } catch (e) {
    if (isUniqueViolation(e)) {
      redirect(withParam(`${INSTITUTES_PATH}?tab=add`, "error", "මෙම නමින් හෝ කේතයෙන් ආයතනයක් දැනටමත් ඇත"));
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

  // කේතය වෙනස් කළ හොත් අලුතින් ලියාපදිංචි වන අයගේ index වලට පමණක් බලපායි (පවතින index අංක වෙනස් නොවේ)
  const code = parseInstituteCode(formData.get("code"));
  if (!code.ok) redirect(withParam(INSTITUTES_PATH, "error", code.error));

  try {
    await db.update(institutes).set(code.code ? { name: parsed.data, code: code.code } : { name: parsed.data }).where(eq(institutes.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) {
      redirect(withParam(INSTITUTES_PATH, "error", "මෙම නමින් හෝ කේතයෙන් ආයතනයක් දැනටමත් ඇත"));
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

/* ---------------- දෙමාපිය සම්බන්ධතා (Admin) සහ සතිපතා සාරාංශ යැවීම ---------------- */

async function updateParentContactAdminImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, SECRET_KEYS);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = parentContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const [cur] = await db.select({ email: users.parentEmail }).from(users).where(and(eq(users.id, id), eq(users.role, "STUDENT"))).limit(1);
  if (!cur) return { error: "සිසුවා හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
  await db
    .update(users)
    .set({
      parentEmail: d.parentEmail || null,
      parentPhone: d.parentPhone,
      ...((cur.email ?? "") !== d.parentEmail ? { parentUnsubscribedAt: null } : {}),
    })
    .where(eq(users.id, id));
  await audit(admin.id, "student.parent_contact", id, undefined, id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "දෙමාපිය සම්බන්ධතා සුරැකිණි.", values };
}

export type SendSummariesState = { error?: string; result?: { sent: number; failed: number; total: number } };

// එකඟ වූ සියලු දෙමාපියන්ට Email සාරාංශ දැන්ම යවයි (සිසුවෙකුට දින 6කට වරක් පමණි)
export async function sendParentSummariesAction(): Promise<SendSummariesState> {
  const admin = await requireAdmin();
  const t = await getT();
  if (!(await rateLimit(`parent-summaries:${admin.id}`, 3, 60 * 60_000))) return { error: t("උත්සාහ ගණන වැඩියි. පසුව නැවත උත්සාහ කරන්න.") };
  const result = await sendWeeklySummaries();
  await audit(admin.id, "parent.summaries_sent", `${result.sent}`, `failed=${result.failed}`);
  revalidatePath("/admin/parents");
  return { result };
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function createStudentAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await createStudentActionImpl(prev, formData));
}

export async function updateStudentAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await updateStudentActionImpl(prev, formData));
}

/* --------------------------- සිසුන් එකවර import (CSV) --------------------------- */

export async function importStudentsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const t = await getT();
  const intent = formData.get("intent")?.toString() === "import" ? "import" : "preview";
  if (!(await rateLimit(`student-import:${admin.id}`, intent === "import" ? 10 : 60, 60 * 60_000))) {
    return { error: t("උත්සාහ ගණන වැඩියි. පසුව නැවත උත්සාහ කරන්න.") };
  }

  // CSV: උඩුගත කළ file එක, නැත්නම් අලවන ලද පෙළ
  let csv = "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > IMPORT_MAX_BYTES) return { error: t("File එක විශාල වැඩියි (උපරිම KB 200).") };
    csv = await file.text();
  } else {
    csv = formData.get("csv")?.toString() ?? "";
  }
  if (csv.length > IMPORT_MAX_BYTES) return { error: t("File එක විශාල වැඩියි (උපරිම KB 200).") };

  const instituteId = formData.get("instituteId")?.toString() ?? "";
  const insts = await db.select({ id: institutes.id, name: institutes.name }).from(institutes);
  const defaultInst = insts.find((i) => i.id === instituteId);
  if (!defaultInst) return { error: t("පෙරනිමි ආයතනය තෝරන්න") };

  const parsed = readImportCsv(csv);
  if (parsed.error === "empty") return { error: t("CSV හි header පේළියක් සහ අවම වශයෙන් එක් සිසුවෙක් අවශ්‍යයි") };
  if (parsed.error === "missing") return { error: t("අඩු තීරු: {cols}", { cols: (parsed.missing ?? []).join(", ") }) };
  if (parsed.rows.length > IMPORT_MAX_ROWS) return { error: t("එක් වරකට උපරිම සිසුන් {n}ක් import කළ හැක.", { n: IMPORT_MAX_ROWS }) };

  const existing = new Set((await db.select({ email: users.email }).from(users)).map((u) => u.email));
  const seen = new Set<string>();
  const results: ImportRowResult[] = [];
  const valid: { line: number; d: z.infer<typeof adminCreateStudentSchema> }[] = [];
  for (const r of parsed.rows) {
    const errors: string[] = [];
    let inst = defaultInst;
    if (r.institute) {
      const hit = insts.find((i) => i.name.trim().toLowerCase() === r.institute.trim().toLowerCase());
      if (hit) inst = hit;
      else errors.push(t("නොදන්නා ආයතනයක්: {x}", { x: r.institute }));
    }
    const res = adminCreateStudentSchema.safeParse({ name: r.name, school: r.school, grade: r.grade, medium: r.medium, phone: r.phone, email: r.email, alYear: r.alYear, instituteId: inst.id, parentPhone: r.parentPhone, parentEmail: r.parentEmail });
    if (!res.success) {
      for (const [k, v] of Object.entries(fieldErrorsOf(res.error))) for (const m of v ?? []) errors.push(`${k}: ${t(m)}`);
    } else {
      if (existing.has(res.data.email)) errors.push(t("මෙම email ලිපිනය දැනටමත් භාවිතා වේ"));
      else if (seen.has(res.data.email)) errors.push(t("File එකේ email ලිපිනය දෙවරක් ඇත"));
      seen.add(res.data.email);
    }
    const ok = errors.length === 0 && res.success;
    results.push({ line: r.line, name: r.name, email: r.email, ok, errors });
    if (ok && res.success) valid.push({ line: r.line, d: res.data });
  }

  if (intent === "preview") {
    return { preview: { rows: results, okCount: valid.length, csv, instituteId } };
  }

  // import: වලංගු පේළි පමණක් සාදයි (අසාර්ථක ඒවා වාර්තා කරයි)
  const failed = results.filter((r) => !r.ok);
  const credentials: TempCredential[] = [];
  const expires = tempPasswordExpiry();
  for (const { line, d } of valid) {
    try {
      const temp = generateTempPassword();
      const [c] = await db
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
          parentPhone: d.parentPhone,
          parentEmail: d.parentEmail || null,
          role: "STUDENT",
          status: "ACTIVE",
          emailVerified: new Date(),
          passwordHash: await hashPassword(temp),
          mustChangePassword: true,
          tempPasswordExpiresAt: expires,
        })
        .returning({ id: users.id, indexNo: users.indexNo });
      credentials.push({ id: c.id, name: d.name, email: d.email, indexNo: c.indexNo ?? "", password: temp, expires: fmtDate(expires) });
      await audit(admin.id, "student.create", d.email, undefined, c.id);
    } catch (e) {
      if (!isUniqueViolation(e)) console.error("import student failed", e);
      failed.push({ line, name: d.name, email: d.email, ok: false, errors: [t(isUniqueViolation(e) ? "මෙම email ලිපිනය දැනටමත් භාවිතා වේ" : "සිසුවා සෑදීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.")] });
    }
  }
  await audit(admin.id, "student.import", `${credentials.length}`);
  revalidatePath("/admin", "layout");
  return { done: { created: credentials.length, failed: failed.sort((a, b) => a.line - b.line), credentials, expires: fmtDate(expires) } };
}

/* --------------------------- වර්ෂාවසානයේ ශ්‍රේණි උසස් කිරීම --------------------------- */

// තෝරාගත් ශ්‍රේණි වල සිසුන් එක ශ්‍රේණියකින් ඉහළට (11 -> උසස් පෙළ). Super Admin පමණි.
// එක් UPDATE එකක් (පැරණි අගයන් මත ක්‍රියා කරයි) -> කිසිවෙකු දෙවරක් උසස් නොවේ
export async function promoteStudentsAction(_prev: PromoteState, formData: FormData): Promise<PromoteState> {
  const admin = await requireSuperAdmin();
  const t = await getT();
  const intent = formData.get("intent")?.toString() === "promote" ? "promote" : "preview";
  const grades = [...new Set(formData.getAll("g").map((v) => Number(v)))].filter((g) => (PROMOTABLE_GRADES as readonly number[]).includes(g)).sort((a, b) => a - b);
  const medium = formData.get("medium")?.toString() ?? "";
  const mediumFilter = medium === "SINHALA" || medium === "ENGLISH" ? medium : null;
  const alYear = formData.get("alYear")?.toString() ?? "";
  if (grades.length === 0) return { error: t("උසස් කළ යුතු ශ්‍රේණි අවම වශයෙන් එකක් තෝරන්න.") };
  if (grades.includes(11) && !alExamYears().includes(Number(alYear))) return { error: t("11 ශ්‍රේණියේ සිසුන් උසස් පෙළට යවන නිසා A/L විභාග වර්ෂය තෝරන්න.") };

  const where = and(eq(users.role, "STUDENT"), inArray(users.grade, grades), mediumFilter ? eq(users.medium, mediumFilter) : undefined);
  const counts = await db.select({ grade: users.grade, n: sql<number>`count(*)::int` }).from(users).where(where).groupBy(users.grade);
  const byGrade = Object.fromEntries(counts.map((c) => [c.grade, c.n])) as Record<number, number>;
  const total = counts.reduce((n, c) => n + c.n, 0);

  if (intent === "preview") return { preview: { grades, byGrade, total, medium: mediumFilter ?? "", alYear } };

  if (formData.get("confirm")?.toString().trim() !== "PROMOTE") return { error: t("තහවුරු කිරීමට PROMOTE ලෙස ටයිප් කරන්න."), preview: { grades, byGrade, total, medium: mediumFilter ?? "", alYear } };
  if (!(await rateLimit(`promote:${admin.id}`, 5, 60 * 60_000))) return { error: t("උත්සාහ ගණන වැඩියි. පසුව නැවත උත්සාහ කරන්න.") };

  const updated = await db
    .update(users)
    .set({
      grade: sql`${users.grade} + 1`,
      alYear: sql`case when ${users.grade} = 11 then ${Number(alYear)}::int else ${users.alYear} end`,
    })
    .where(where)
    .returning({ id: users.id });
  await audit(admin.id, "student.promote", `${updated.length}`, `grades=${grades.join(",")};medium=${mediumFilter ?? "all"}${grades.includes(11) ? `;alYear=${alYear}` : ""}`);
  revalidatePath("/admin", "layout");
  return { done: { count: updated.length, byGrade } };
}

export async function updateParentContactAdminAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await updateParentContactAdminImpl(prev, formData));
}

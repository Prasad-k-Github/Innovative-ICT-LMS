"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { audit } from "@/lib/audit";
import { GENERAL_TYPES, GRADES, MEDIUMS, typesForKind, type ContentType, type LessonKind } from "@/lib/constants";
import { isUniqueViolation } from "@/lib/db-errors";
import { localized } from "@/lib/i18n/server";
import { notifyStudentsFor } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";
import { lessonSchema, resourceSchema, valuesFrom, type FormState } from "@/lib/validators";

// පාඩම් සහ Google Drive links කළමනාකරණය: Admin සහ Super Admin දෙදෙනාටම.
// සෑම action එකක්ම requireAdmin() සමඟ නැවත පරීක්ෂා කරයි (Server Actions public endpoints නිසා).

function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
}

function scope(grade: FormDataEntryValue | null, medium: FormDataEntryValue | null) {
  const g = Number(grade);
  const m = String(medium);
  if (!(GRADES as readonly number[]).includes(g) || !(MEDIUMS as readonly string[]).includes(m)) return null;
  return { grade: g, medium: m as (typeof MEDIUMS)[number] };
}

const kindOf = (v: FormDataEntryValue | null): LessonKind => (v === "TUTE" ? "TUTE" : "LESSON");
const lessonPath = (id: string, kind: LessonKind = "LESSON") => `/admin/${kind === "TUTE" ? "tutes" : "lessons"}/${id}`;
const listPath = (kind: LessonKind) => (kind === "TUTE" ? "/admin/tutes" : "/admin/lessons");
const dupMsg = (kind: LessonKind) => (kind === "TUTE" ? "මෙම ශ්‍රේණියේ/මාධ්‍යයේ මෙම නමින් Tute එකක් දැනටමත් ඇත" : "මෙම ශ්‍රේණියේ/මාධ්‍යයේ මෙම නමින් පාඩමක් දැනටමත් ඇත");
const papersPath = (grade: number, medium: string) => `/admin/papers?grade=${grade}&medium=${medium}`;
const withNotice = (path: string, notice: string) => `${path}${path.includes("?") ? "&" : "?"}notice=${notice}`;

/* ------------------------------- පාඩම් ------------------------------- */

async function createLessonImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const sc = scope(formData.get("grade"), formData.get("medium"));
  if (!sc) return { error: "ශ්‍රේණිය සහ මාධ්‍යය තෝරන්න.", values };
  const kind = kindOf(formData.get("kind"));
  const parsed = lessonSchema.safeParse({ title: formData.get("title"), order: formData.get("order") || 0 });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  // අංකය හිස් නම් අවසානයට එක් කරයි
  let order = parsed.data.order;
  if (!formData.get("order")) {
    const [m] = await db
      .select({ v: max(lessons.order) })
      .from(lessons)
      .where(and(eq(lessons.grade, sc.grade), eq(lessons.medium, sc.medium), eq(lessons.kind, kind)));
    order = (m?.v ?? 0) + 1;
  }

  let id: string;
  try {
    const [row] = await db
      .insert(lessons)
      .values({ title: parsed.data.title, order, grade: sc.grade, medium: sc.medium, kind })
      .returning({ id: lessons.id });
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { title: [dupMsg(kind)] }, values };
    throw e;
  }
  await audit(admin.id, kind === "TUTE" ? "tute.create" : "lesson.create", parsed.data.title);
  await notifyStudentsFor({ grade: sc.grade, medium: sc.medium }, kind === "TUTE" ? "TUTE_ADDED" : "LESSON_ADDED", { title: parsed.data.title, id });
  refresh();
  redirect(withNotice(lessonPath(id, kind), "created"));
}

async function updateLessonImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = lessonSchema.safeParse({ title: formData.get("title"), order: formData.get("order") || 0 });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  let kind: LessonKind = "LESSON";
  try {
    const r = await db.update(lessons).set({ title: parsed.data.title, order: parsed.data.order }).where(eq(lessons.id, id)).returning({ id: lessons.id, kind: lessons.kind });
    if (!r.length) return { error: "පාඩම හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
    kind = r[0].kind;
  } catch (e) {
    if (isUniqueViolation(e)) {
      const [cur] = await db.select({ kind: lessons.kind }).from(lessons).where(eq(lessons.id, id)).limit(1);
      return { fieldErrors: { title: [dupMsg(cur?.kind ?? "LESSON")] }, values };
    }
    throw e;
  }
  await audit(admin.id, kind === "TUTE" ? "tute.update" : "lesson.update", parsed.data.title);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

export async function toggleLessonAction(id: string) {
  const admin = await requireAdmin();
  const [l] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!l) redirect("/admin/lessons");
  const pre = l.kind === "TUTE" ? "tute" : "lesson";
  await db.update(lessons).set({ isPublished: !l.isPublished }).where(eq(lessons.id, id));
  await audit(admin.id, l.isPublished ? `${pre}.hide` : `${pre}.publish`, l.title);
  if (!l.isPublished) await notifyStudentsFor({ grade: l.grade, medium: l.medium }, l.kind === "TUTE" ? "TUTE_ADDED" : "LESSON_ADDED", { title: l.title, id });
  refresh();
  redirect(withNotice(`${lessonPath(id, l.kind)}?tab=edit`, l.isPublished ? "hidden" : "published"));
}

export async function deleteLessonAction(id: string) {
  const admin = await requireAdmin();
  const [l] = await db.delete(lessons).where(eq(lessons.id, id)).returning();
  if (l) await audit(admin.id, l.kind === "TUTE" ? "tute.delete" : "lesson.delete", l.title);
  refresh();
  redirect(l ? `${listPath(l.kind)}?grade=${l.grade}&medium=${l.medium}&notice=deleted` : "/admin/lessons");
}

/* ------------------------- අන්තර්ගතය (Drive links) ------------------------- */

async function createResourceImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["lessonId", "grade", "medium"]);
  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const lessonId = formData.get("lessonId")?.toString() || null;
  let grade: number, medium: (typeof MEDIUMS)[number];
  let allowed: ContentType[];
  let lessonKind: LessonKind = "LESSON";
  if (lessonId) {
    const [l] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!l) return { error: "පාඩම හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
    grade = l.grade;
    medium = l.medium;
    lessonKind = l.kind;
    allowed = typesForKind(l.kind); // Tute එකකට Model/Past Papers, Recordings, Notes පමණි (server පැත්තෙන්ද බලපෑමට)
  } else {
    const sc = scope(formData.get("grade"), formData.get("medium"));
    if (!sc) return { error: "ශ්‍රේණිය සහ මාධ්‍යය තෝරන්න.", values };
    grade = sc.grade;
    medium = sc.medium;
    allowed = GENERAL_TYPES;
  }
  if (!allowed.includes(d.type)) return { fieldErrors: { type: ["වර්ගය තෝරන්න"] }, values };

  let lessonVisible = true;
  if (lessonId) {
    const [ls] = await db.select({ p: lessons.isPublished }).from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    lessonVisible = ls?.p ?? false;
  }
  await db.insert(resources).values({
    title: d.title,
    type: d.type,
    driveUrl: d.driveUrl,
    year: d.year ? Number(d.year) : null,
    grade,
    medium,
    lessonId,
  });
  await audit(admin.id, "resource.create", `${d.type}${d.title ? `: ${d.title}` : ""}`);
  if (lessonVisible) await notifyStudentsFor({ grade, medium }, "RESOURCE_ADDED", { title: d.title ?? "", kind: d.type, lessonId, tute: lessonKind === "TUTE" ? 1 : 0 });
  refresh();
  return { ok: true, message: "එක් කරන ලදී.", values: { type: d.type } };
}

async function updateResourceImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;

  const [r] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
  if (!r) return { error: "අන්තර්ගතය හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
  let allowed = GENERAL_TYPES;
  if (r.lessonId) {
    const [ls] = await db.select({ kind: lessons.kind }).from(lessons).where(eq(lessons.id, r.lessonId)).limit(1);
    allowed = typesForKind(ls?.kind ?? "LESSON");
  }
  if (!allowed.includes(d.type)) return { fieldErrors: { type: ["වර්ගය තෝරන්න"] }, values };

  await db
    .update(resources)
    .set({ type: d.type, title: d.title, driveUrl: d.driveUrl, year: d.year ? Number(d.year) : null })
    .where(eq(resources.id, id));
  await audit(admin.id, "resource.update", `${d.type}${d.title ? `: ${d.title}` : ""}`);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

async function backPath(r: { lessonId: string | null; grade: number; medium: string }) {
  if (!r.lessonId) return papersPath(r.grade, r.medium);
  const [ls] = await db.select({ kind: lessons.kind }).from(lessons).where(eq(lessons.id, r.lessonId)).limit(1);
  return lessonPath(r.lessonId, ls?.kind ?? "LESSON");
}
async function isTuteLesson(lessonId: string | null) {
  if (!lessonId) return false;
  const [ls] = await db.select({ kind: lessons.kind }).from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  return ls?.kind === "TUTE";
}

export async function toggleResourceAction(id: string) {
  const admin = await requireAdmin();
  const [r] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
  if (!r) redirect("/admin/lessons");
  await db.update(resources).set({ isPublished: !r.isPublished }).where(eq(resources.id, id));
  await audit(admin.id, r.isPublished ? "resource.hide" : "resource.publish", `${r.type}${r.title ? `: ${r.title}` : ""}`);
  if (!r.isPublished) await notifyStudentsFor({ grade: r.grade, medium: r.medium }, "RESOURCE_ADDED", { title: r.title ?? "", kind: r.type, lessonId: r.lessonId, tute: (await isTuteLesson(r.lessonId)) ? 1 : 0 });
  refresh();
  redirect(withNotice(await backPath(r), r.isPublished ? "r-hidden" : "r-published"));
}

export async function deleteResourceAction(id: string) {
  const admin = await requireAdmin();
  const [r] = await db.delete(resources).where(eq(resources.id, id)).returning();
  if (!r) redirect("/admin/lessons");
  await audit(admin.id, "resource.delete", `${r.type}${r.title ? `: ${r.title}` : ""}`);
  refresh();
  redirect(withNotice(await backPath(r), "r-deleted"));
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function createLessonAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await createLessonImpl(prev, fd));
}
export async function updateLessonAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateLessonImpl(prev, fd));
}
export async function createResourceAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await createResourceImpl(prev, fd));
}
export async function updateResourceAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateResourceImpl(prev, fd));
}

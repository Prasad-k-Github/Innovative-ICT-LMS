"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { audit } from "@/lib/audit";
import { GENERAL_TYPES, GRADES, LESSON_TYPES, MEDIUMS, type ContentType } from "@/lib/constants";
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

const lessonPath = (id: string) => `/admin/lessons/${id}`;
const papersPath = (grade: number, medium: string) => `/admin/papers?grade=${grade}&medium=${medium}`;
const withNotice = (path: string, notice: string) => `${path}${path.includes("?") ? "&" : "?"}notice=${notice}`;

/* ------------------------------- පාඩම් ------------------------------- */

async function createLessonImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const sc = scope(formData.get("grade"), formData.get("medium"));
  if (!sc) return { error: "ශ්‍රේණිය සහ මාධ්‍යය තෝරන්න.", values };
  const parsed = lessonSchema.safeParse({ title: formData.get("title"), order: formData.get("order") || 0 });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  // අංකය හිස් නම් අවසානයට එක් කරයි
  let order = parsed.data.order;
  if (!formData.get("order")) {
    const [m] = await db
      .select({ v: max(lessons.order) })
      .from(lessons)
      .where(and(eq(lessons.grade, sc.grade), eq(lessons.medium, sc.medium)));
    order = (m?.v ?? 0) + 1;
  }

  let id: string;
  try {
    const [row] = await db
      .insert(lessons)
      .values({ title: parsed.data.title, order, grade: sc.grade, medium: sc.medium })
      .returning({ id: lessons.id });
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { title: ["මෙම ශ්‍රේණියේ/මාධ්‍යයේ මෙම නමින් පාඩමක් දැනටමත් ඇත"] }, values };
    throw e;
  }
  await audit(admin.id, "lesson.create", parsed.data.title);
  await notifyStudentsFor({ grade: sc.grade, medium: sc.medium }, "LESSON_ADDED", { title: parsed.data.title, id });
  refresh();
  redirect(withNotice(lessonPath(id), "created"));
}

async function updateLessonImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = lessonSchema.safeParse({ title: formData.get("title"), order: formData.get("order") || 0 });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  try {
    const r = await db.update(lessons).set({ title: parsed.data.title, order: parsed.data.order }).where(eq(lessons.id, id)).returning({ id: lessons.id });
    if (!r.length) return { error: "පාඩම හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { title: ["මෙම ශ්‍රේණියේ/මාධ්‍යයේ මෙම නමින් පාඩමක් දැනටමත් ඇත"] }, values };
    throw e;
  }
  await audit(admin.id, "lesson.update", parsed.data.title);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

export async function toggleLessonAction(id: string) {
  const admin = await requireAdmin();
  const [l] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!l) redirect("/admin/lessons");
  await db.update(lessons).set({ isPublished: !l.isPublished }).where(eq(lessons.id, id));
  await audit(admin.id, l.isPublished ? "lesson.hide" : "lesson.publish", l.title);
  if (!l.isPublished) await notifyStudentsFor({ grade: l.grade, medium: l.medium }, "LESSON_ADDED", { title: l.title, id });
  refresh();
  redirect(withNotice(`${lessonPath(id)}?tab=edit`, l.isPublished ? "hidden" : "published"));
}

export async function deleteLessonAction(id: string) {
  const admin = await requireAdmin();
  const [l] = await db.delete(lessons).where(eq(lessons.id, id)).returning();
  if (l) await audit(admin.id, "lesson.delete", l.title);
  refresh();
  redirect(l ? `/admin/lessons?grade=${l.grade}&medium=${l.medium}&notice=deleted` : "/admin/lessons");
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
  if (lessonId) {
    const [l] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!l) return { error: "පාඩම හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
    grade = l.grade;
    medium = l.medium;
    allowed = LESSON_TYPES;
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
  if (lessonVisible) await notifyStudentsFor({ grade, medium }, "RESOURCE_ADDED", { title: d.title ?? "", kind: d.type, lessonId });
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
  const allowed = r.lessonId ? LESSON_TYPES : GENERAL_TYPES;
  if (!allowed.includes(d.type)) return { fieldErrors: { type: ["වර්ගය තෝරන්න"] }, values };

  await db
    .update(resources)
    .set({ type: d.type, title: d.title, driveUrl: d.driveUrl, year: d.year ? Number(d.year) : null })
    .where(eq(resources.id, id));
  await audit(admin.id, "resource.update", `${d.type}${d.title ? `: ${d.title}` : ""}`);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

function backPath(r: { lessonId: string | null; grade: number; medium: string }) {
  return r.lessonId ? lessonPath(r.lessonId) : papersPath(r.grade, r.medium);
}

export async function toggleResourceAction(id: string) {
  const admin = await requireAdmin();
  const [r] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
  if (!r) redirect("/admin/lessons");
  await db.update(resources).set({ isPublished: !r.isPublished }).where(eq(resources.id, id));
  await audit(admin.id, r.isPublished ? "resource.hide" : "resource.publish", `${r.type}${r.title ? `: ${r.title}` : ""}`);
  if (!r.isPublished) await notifyStudentsFor({ grade: r.grade, medium: r.medium }, "RESOURCE_ADDED", { title: r.title ?? "", kind: r.type, lessonId: r.lessonId });
  refresh();
  redirect(withNotice(backPath(r), r.isPublished ? "r-hidden" : "r-published"));
}

export async function deleteResourceAction(id: string) {
  const admin = await requireAdmin();
  const [r] = await db.delete(resources).where(eq(resources.id, id)).returning();
  if (!r) redirect("/admin/lessons");
  await audit(admin.id, "resource.delete", `${r.type}${r.title ? `: ${r.title}` : ""}`);
  refresh();
  redirect(withNotice(backPath(r), "r-deleted"));
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

"use server";

import { count, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { assignments, institutes, quizAttempts, quizQuestions, quizzes, submissions } from "@/db/schema";
import { notifyStudentsFor, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { QUIZ_MAX_OPTIONS } from "@/lib/constants";
import { localized } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { assignmentSchema, gradeSubmissionSchema, questionSchema, quizSchema, valuesFrom, type FormState } from "@/lib/validators";

// පැවරුම් සහ Quiz කළමනාකරණය: Admin සහ Super Admin දෙදෙනාටම.
// සෑම action එකක්ම requireAdmin() සමඟ නැවත පරීක්ෂා කරයි (Server Actions public endpoints නිසා).

function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}
function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
}
const withNotice = (path: string, notice: string) => `${path}${path.includes("?") ? "&" : "?"}notice=${notice}`;

// ආයතනය හිස් නම් null (සියලු ආයතන); ඇති ආයතනයක් නොවේ නම් undefined (වැරදි)
async function resolveInstitute(raw: string | undefined): Promise<string | null | undefined> {
  if (!raw) return null;
  const [i] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, raw)).limit(1);
  return i ? i.id : undefined;
}

/* ------------------------------ පැවරුම් ------------------------------ */

async function createAssignmentImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const instituteId = await resolveInstitute(d.instituteId);
  if (instituteId === undefined) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };

  const [row] = await db
    .insert(assignments)
    .values({
      title: d.title,
      description: d.description,
      grade: d.grade,
      medium: d.medium,
      instituteId,
      attachmentUrl: d.attachmentUrl || null,
      dueAt: d.dueAt,
      maxMarks: d.maxMarks ? Number(d.maxMarks) : null,
      createdBy: admin.id,
    })
    .returning({ id: assignments.id });
  await audit(admin.id, "assignment.create", d.title);
  await notifyStudentsFor({ grade: d.grade, medium: d.medium, instituteId }, "ASSIGNMENT_NEW", { id: row.id, title: d.title });
  refresh();
  redirect(withNotice(`/admin/assignments/${row.id}`, "created"));
}

async function updateAssignmentImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const instituteId = await resolveInstitute(d.instituteId);
  if (instituteId === undefined) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };
  const r = await db
    .update(assignments)
    .set({
      title: d.title,
      description: d.description,
      grade: d.grade,
      medium: d.medium,
      instituteId,
      attachmentUrl: d.attachmentUrl || null,
      dueAt: d.dueAt,
      maxMarks: d.maxMarks ? Number(d.maxMarks) : null,
    })
    .where(eq(assignments.id, id))
    .returning({ id: assignments.id });
  if (!r.length) return { error: "පැවරුම හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
  await audit(admin.id, "assignment.update", d.title);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

export async function toggleAssignmentAction(id: string) {
  const admin = await requireAdmin();
  const [a] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  if (!a) redirect("/admin/assignments");
  await db.update(assignments).set({ isPublished: !a.isPublished }).where(eq(assignments.id, id));
  await audit(admin.id, a.isPublished ? "assignment.hide" : "assignment.publish", a.title);
  if (!a.isPublished) await notifyStudentsFor({ grade: a.grade, medium: a.medium, instituteId: a.instituteId }, "ASSIGNMENT_NEW", { id, title: a.title });
  refresh();
  redirect(withNotice(`/admin/assignments/${id}`, a.isPublished ? "hidden" : "published"));
}

export async function deleteAssignmentAction(id: string) {
  const admin = await requireAdmin();
  const [a] = await db.delete(assignments).where(eq(assignments.id, id)).returning();
  if (a) await audit(admin.id, "assignment.delete", a.title);
  refresh();
  redirect(withNotice("/admin/assignments", "deleted"));
}

async function gradeSubmissionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = gradeSubmissionSchema.safeParse({ marks: formData.get("marks") ?? "", feedback: formData.get("feedback") ?? "" });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const [row] = await db
    .select({ sub: submissions, max: assignments.maxMarks, title: assignments.title })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.id, id))
    .limit(1);
  if (!row) return { error: "ඉදිරිපත් කිරීම හමු නොවීය.", values };
  const marks = parsed.data.marks ? Number(parsed.data.marks) : null;
  if (marks !== null && row.max !== null && marks > row.max) return { fieldErrors: { marks: ["ලකුණු උපරිම ලකුණු ඉක්මවා ඇත"] }, values };

  const graded = marks !== null || parsed.data.feedback.length > 0;
  await db
    .update(submissions)
    .set({ marks, feedback: parsed.data.feedback || null, gradedAt: graded ? new Date() : null, gradedBy: graded ? admin.id : null })
    .where(eq(submissions.id, id));
  await audit(admin.id, "assignment.grade", row.title, marks !== null ? String(marks) : undefined, row.sub.studentId);
  if (graded) await notifyUsers([row.sub.studentId], "ASSIGNMENT_GRADED", { id: row.sub.assignmentId, title: row.title, marks, max: row.max });
  refresh();
  return { ok: true, message: "ලකුණු සුරැකිණි.", values };
}

// සිසුවෙකුගේ ඉදිරිපත් කිරීම මකා දමයි (සිසුවාට නැවත උඩුගත කළ හැක)
export async function deleteSubmissionAction(id: string) {
  const admin = await requireAdmin();
  const [s] = await db.delete(submissions).where(eq(submissions.id, id)).returning();
  if (!s) redirect("/admin/assignments");
  const [a] = await db.select({ title: assignments.title }).from(assignments).where(eq(assignments.id, s.assignmentId)).limit(1);
  await audit(admin.id, "submission.delete", a?.title, undefined, s.studentId);
  refresh();
  redirect(withNotice(`/admin/assignments/${s.assignmentId}`, "sub-deleted"));
}

/* -------------------------------- Quiz -------------------------------- */

async function createQuizImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const parsed = quizSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const instituteId = await resolveInstitute(d.instituteId);
  if (instituteId === undefined) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };
  const [row] = await db
    .insert(quizzes)
    .values({
      title: d.title,
      description: d.description,
      grade: d.grade,
      medium: d.medium,
      instituteId,
      opensAt: d.opensAt,
      closesAt: d.closesAt,
      durationMinutes: d.durationMinutes,
      revealAnswers: d.revealAnswers === "on",
      isPublished: false,
      createdBy: admin.id,
    })
    .returning({ id: quizzes.id });
  await audit(admin.id, "quiz.create", d.title);
  refresh();
  redirect(withNotice(`/admin/quizzes/${row.id}`, "created"));
}

async function updateQuizImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const parsed = quizSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const d = parsed.data;
  const instituteId = await resolveInstitute(d.instituteId);
  if (instituteId === undefined) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };
  const r = await db
    .update(quizzes)
    .set({
      title: d.title,
      description: d.description,
      grade: d.grade,
      medium: d.medium,
      instituteId,
      opensAt: d.opensAt,
      closesAt: d.closesAt,
      durationMinutes: d.durationMinutes,
      revealAnswers: d.revealAnswers === "on",
    })
    .where(eq(quizzes.id, id))
    .returning({ id: quizzes.id });
  if (!r.length) return { error: "Quiz එක හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
  await audit(admin.id, "quiz.update", d.title);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

export async function toggleQuizAction(id: string) {
  const admin = await requireAdmin();
  const [q] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!q) redirect("/admin/quizzes");
  if (!q.isPublished) {
    const [{ n }] = await db.select({ n: count() }).from(quizQuestions).where(eq(quizQuestions.quizId, id));
    if (n === 0) redirect(withNotice(`/admin/quizzes/${id}`, "need-questions"));
  }
  await db.update(quizzes).set({ isPublished: !q.isPublished }).where(eq(quizzes.id, id));
  await audit(admin.id, q.isPublished ? "quiz.hide" : "quiz.publish", q.title);
  if (!q.isPublished) await notifyStudentsFor({ grade: q.grade, medium: q.medium, instituteId: q.instituteId }, "QUIZ_NEW", { id, title: q.title });
  refresh();
  redirect(withNotice(`/admin/quizzes/${id}`, q.isPublished ? "hidden" : "published"));
}

export async function deleteQuizAction(id: string) {
  const admin = await requireAdmin();
  const [q] = await db.delete(quizzes).where(eq(quizzes.id, id)).returning();
  if (q) await audit(admin.id, "quiz.delete", q.title);
  refresh();
  redirect(withNotice("/admin/quizzes", "deleted"));
}

async function hasAttempts(quizId: string) {
  const [{ n }] = await db.select({ n: count() }).from(quizAttempts).where(eq(quizAttempts.quizId, quizId));
  return n > 0;
}

// ප්‍රශ්න form එකෙන් (option0..option5 + correct slot) ලබා ගනී. හිස් පිළිතුරු ඉවත් කර නිවැරදි පිළිතුරේ ස්ථානය සකසයි.
function readQuestion(formData: FormData) {
  const options = Array.from({ length: QUIZ_MAX_OPTIONS }, (_, i) => String(formData.get(`option${i}`) ?? ""));
  const parsed = questionSchema.safeParse({
    text: formData.get("text"),
    options,
    correct: formData.get("correct") ?? "-1",
    marks: formData.get("marks") || 1,
    explanation: formData.get("explanation") ?? "",
  });
  if (!parsed.success) return { error: parsed.error };
  const d = parsed.data;
  const trimmed = d.options.map((o) => o.trim());
  const compact = trimmed.filter(Boolean);
  const correctIndex = trimmed.slice(0, d.correct).filter(Boolean).length;
  return { data: { text: d.text, options: compact, correctIndex, marks: d.marks, explanation: d.explanation } };
}

const LOCKED = "සිසුන් උත්සාහ කර ඇති නිසා ප්‍රශ්න වෙනස් කළ නොහැක. පළමුව සිසුන්ගේ උත්සාහයන් ඉවත් කරන්න.";

async function addQuestionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["quizId"]);
  const quizId = formData.get("quizId")?.toString() ?? "";
  const r = readQuestion(formData);
  if (r.error) return { fieldErrors: fieldErrorsOf(r.error), values };
  const [q] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!q) return { error: "Quiz එක හමු නොවීය (ඉවත් කර ඇති විය හැක).", values };
  if (await hasAttempts(quizId)) return { error: LOCKED, values };
  const [m] = await db.select({ v: max(quizQuestions.order) }).from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  await db.insert(quizQuestions).values({ quizId, order: (m?.v ?? 0) + 1, ...r.data });
  await audit(admin.id, "quiz.question_add", q.title);
  refresh();
  return { ok: true, message: "ප්‍රශ්නය එක් කරන ලදී.", values: { marks: "1" } };
}

async function updateQuestionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData, ["id"]);
  const id = formData.get("id")?.toString() ?? "";
  const r = readQuestion(formData);
  if (r.error) return { fieldErrors: fieldErrorsOf(r.error), values };
  const [row] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).limit(1);
  if (!row) return { error: "ප්‍රශ්නය හමු නොවීය.", values };
  if (await hasAttempts(row.quizId)) return { error: LOCKED, values };
  await db.update(quizQuestions).set(r.data).where(eq(quizQuestions.id, id));
  const [q] = await db.select({ title: quizzes.title }).from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1);
  await audit(admin.id, "quiz.question_update", q?.title);
  refresh();
  return { ok: true, message: "වෙනස්කම් සුරැකිණි.", values };
}

export async function deleteQuestionAction(id: string) {
  const admin = await requireAdmin();
  const [row] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).limit(1);
  if (!row) redirect("/admin/quizzes");
  if (await hasAttempts(row.quizId)) redirect(withNotice(`/admin/quizzes/${row.quizId}`, "locked"));
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
  // ප්‍රශ්න නැති Quiz එකක් සිසුන්ට පෙනෙන්නට නොදීමට
  const [{ n }] = await db.select({ n: count() }).from(quizQuestions).where(eq(quizQuestions.quizId, row.quizId));
  if (n === 0) await db.update(quizzes).set({ isPublished: false }).where(eq(quizzes.id, row.quizId));
  const [q] = await db.select({ title: quizzes.title }).from(quizzes).where(eq(quizzes.id, row.quizId)).limit(1);
  await audit(admin.id, "quiz.question_delete", q?.title);
  refresh();
  redirect(withNotice(`/admin/quizzes/${row.quizId}`, "q-deleted"));
}

// සිසුවෙකුගේ Quiz උත්සාහය ඉවත් කරයි (නැවත උත්සාහ කිරීමට ඉඩ දෙයි)
export async function resetAttemptAction(id: string) {
  const admin = await requireAdmin();
  const [a] = await db.delete(quizAttempts).where(eq(quizAttempts.id, id)).returning();
  if (!a) redirect("/admin/quizzes");
  const [q] = await db.select({ title: quizzes.title }).from(quizzes).where(eq(quizzes.id, a.quizId)).limit(1);
  await audit(admin.id, "quiz.attempt_reset", q?.title, undefined, a.studentId);
  await notifyUsers([a.studentId], "QUIZ_RESET", { id: a.quizId, title: q?.title ?? "" });
  refresh();
  redirect(withNotice(`/admin/quizzes/${a.quizId}`, "reset"));
}

/* ---- ප්‍රතිචාර පණිවිඩ වත්මන් භාෂාවට පරිවර්තනය කරන wrappers ---- */

export async function createAssignmentAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await createAssignmentImpl(prev, fd));
}
export async function updateAssignmentAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateAssignmentImpl(prev, fd));
}
export async function gradeSubmissionAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await gradeSubmissionImpl(prev, fd));
}
export async function createQuizAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await createQuizImpl(prev, fd));
}
export async function updateQuizAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateQuizImpl(prev, fd));
}
export async function addQuestionAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await addQuestionImpl(prev, fd));
}
export async function updateQuestionAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await updateQuestionImpl(prev, fd));
}

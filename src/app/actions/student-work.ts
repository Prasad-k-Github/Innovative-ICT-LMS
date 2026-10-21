"use server";

import { createHash } from "node:crypto";
import { and, count, eq, sql, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assignments, quizAttempts, quizQuestions, quizzes, submissionFiles, submissions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { SUBMIT_GRACE_MS, UUID_RE, eligibleFor, finalizeAttempt } from "@/lib/assessment";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_FILES, UPLOAD_MAX_TOTAL_BYTES, UPLOAD_TYPES } from "@/lib/constants";
import { localized } from "@/lib/i18n/server";
import { notifyAdmins } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { requireStudent } from "@/lib/session";
import type { FormState } from "@/lib/validators";

// සිසුන්ගේ පැවරුම් උඩුගත කිරීම සහ Quiz පිළිතුරු සැපයීම.
// සෑම action එකක්ම requireStudent() සමඟ නැවත පරීක්ෂා කර, සිසුවාගේම දත්ත පමණක් භාවිතා කරයි.

function refresh() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}
const withNotice = (path: string, notice: string) => `${path}${path.includes("?") ? "&" : "?"}notice=${notice}`;

/* ------------------------------ පැවරුම් ------------------------------ */

// file හි ආරම්භක bytes දිගුවට ගැළපෙනවාදැයි සරලව පරීක්ෂා කරයි
function magicOk(ext: string, b: Buffer) {
  const starts = (s: string, off = 0) => b.subarray(off, off + s.length).toString("latin1") === s;
  switch (ext) {
    case "pdf":
      return starts("%PDF");
    case "png":
      return b.length > 8 && b[0] === 0x89 && starts("PNG", 1);
    case "jpg":
    case "jpeg":
      return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "webp":
      return starts("RIFF") && starts("WEBP", 8);
    case "docx":
    case "pptx":
    case "xlsx":
    case "zip":
      return starts("PK");
    default:
      return true;
  }
}

function cleanName(name: string) {
  const base = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return base.slice(-150) || "file";
}

async function uploadSubmissionImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent();
  // database පිරී යාම වැළැක්වීමට: සිසුවෙකුට විනාඩි 10කට උඩුගත කිරීම් 20ක්
  if (!(await rateLimit(`upload:${user.id}`, 20, 10 * 60 * 1000))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };
  const assignmentId = formData.get("assignmentId")?.toString() ?? "";
  if (!UUID_RE.test(assignmentId)) return { error: "පැවරුම හමු නොවීය." };

  const [a] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eligibleFor(user, assignments)))
    .limit(1);
  if (!a) return { error: "පැවරුම හමු නොවීය." };
  if (a.dueAt.getTime() < Date.now()) return { error: "අවසාන දිනය ඉකුත් වී ඇති නිසා උඩුගත කළ නොහැක." };

  const [existing] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.assignmentId, a.id), eq(submissions.studentId, user.id)))
    .limit(1);
  if (existing?.gradedAt) return { error: "ලකුණු දමා ඇති නිසා වෙනස් කළ නොහැක." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "උඩුගත කිරීමට file එකක් තෝරන්න." };

  let total = 0;
  const prepared: { filename: string; mime: string; size: number; sha256: string; data: Buffer }[] = [];
  for (const f of files) {
    const filename = cleanName(f.name);
    const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
    if (!Object.hasOwn(UPLOAD_TYPES, ext)) return { error: "මෙම file වර්ගය පිළිගන්නේ නැත (PDF, ඡායාරූප, Word, PowerPoint, Excel, ZIP පමණි)." };
    if (f.size > UPLOAD_MAX_BYTES) return { error: "File එකක් 4MB ට වඩා විශාලයි." };
    total += f.size;
    if (total > UPLOAD_MAX_BYTES) return { error: "එකවර උඩුගත කරන files සම්පූර්ණයෙන් 4MB ට වඩා විශාලයි. කිහිප වතාවකින් උඩුගත කරන්න." };
    const data = Buffer.from(await f.arrayBuffer());
    if (!magicOk(ext, data)) return { error: "File එකේ අන්තර්ගතය එහි වර්ගයට ගැළපෙන්නේ නැත." };
    prepared.push({ filename, mime: UPLOAD_TYPES[ext], size: data.length, sha256: createHash("sha256").update(data).digest("hex"), data });
  }

  if (existing) {
    const [stats] = await db
      .select({ n: count(), bytes: sum(submissionFiles.size) })
      .from(submissionFiles)
      .where(eq(submissionFiles.submissionId, existing.id));
    if (stats.n + prepared.length > UPLOAD_MAX_FILES) return { error: "එක් පැවරුමකට උපරිම files 5ක් පමණි." };
    if (Number(stats.bytes ?? 0) + total > UPLOAD_MAX_TOTAL_BYTES) return { error: "මෙම පැවරුම සඳහා උඩුගත කළ හැකි උපරිම ප්‍රමාණය ඉක්මවා ඇත." };
  } else if (prepared.length > UPLOAD_MAX_FILES) {
    return { error: "එක් පැවරුමකට උපරිම files 5ක් පමණි." };
  }

  const note = (formData.get("note")?.toString() ?? "").trim().slice(0, 500);
  await db
    .insert(submissions)
    .values({ assignmentId: a.id, studentId: user.id, note: note || null })
    .onConflictDoNothing();
  const [sub] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.assignmentId, a.id), eq(submissions.studentId, user.id)))
    .limit(1);
  await db.insert(submissionFiles).values(prepared.map((p) => ({ submissionId: sub.id, ...p })));
  await db.update(submissions).set({ note: note || sub.note, updatedAt: new Date() }).where(eq(submissions.id, sub.id));
  await audit(user.id, "submission.upload", a.title, `${prepared.length}`, user.id);
  if (!existing) await notifyAdmins("SUBMISSION_NEW", { id: a.id, title: a.title, name: user.name });
  refresh();
  return { ok: true, message: "File උඩුගත කරන ලදී." };
}

export async function removeSubmissionFileAction(fileId: string) {
  const user = await requireStudent();
  const [row] = await db
    .select({ f: submissionFiles.id, sub: submissions, a: assignments })
    .from(submissionFiles)
    .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(and(eq(submissionFiles.id, fileId), eq(submissions.studentId, user.id)))
    .limit(1);
  if (!row) redirect("/dashboard/assignments");
  const back = `/dashboard/assignments/${row.a.id}`;
  if (row.sub.gradedAt || row.a.dueAt.getTime() < Date.now()) redirect(withNotice(back, "locked"));

  await db.delete(submissionFiles).where(eq(submissionFiles.id, fileId));
  const [{ n }] = await db.select({ n: count() }).from(submissionFiles).where(eq(submissionFiles.submissionId, row.sub.id));
  if (n === 0) await db.delete(submissions).where(eq(submissions.id, row.sub.id));
  await audit(user.id, "submission.remove_file", row.a.title, undefined, user.id);
  refresh();
  redirect(withNotice(back, "removed"));
}

/* -------------------------------- Quiz -------------------------------- */

async function eligibleQuiz(user: Awaited<ReturnType<typeof requireStudent>>, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [q] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eligibleFor(user, quizzes)))
    .limit(1);
  return q ?? null;
}

export async function startQuizAction(quizId: string) {
  const user = await requireStudent();
  const q = await eligibleQuiz(user, quizId);
  if (!q) redirect("/dashboard/quizzes");
  const back = `/dashboard/quizzes/${q.id}`;
  const now = Date.now();
  if (now < q.opensAt.getTime() || now >= q.closesAt.getTime()) redirect(withNotice(back, "not-open"));

  const deadline = new Date(Math.min(now + q.durationMinutes * 60_000, q.closesAt.getTime()));
  const [created] = await db
    .insert(quizAttempts)
    .values({ quizId: q.id, studentId: user.id, deadlineAt: deadline })
    .onConflictDoNothing()
    .returning({ id: quizAttempts.id });
  if (created) await audit(user.id, "quiz.start", q.title, undefined, user.id);
  refresh();
  redirect(back);
}

// සිසුවා පිළිතුරක් තෝරන සෑම වාරයකම ස්වයංක්‍රීයව සුරකියි (browser වසා ගියත් පිළිතුරු නොනැසීමට)
export async function saveAnswerAction(attemptId: string, questionId: string, optionIndex: number): Promise<{ ok: boolean }> {
  const user = await requireStudent();
  if (!UUID_RE.test(attemptId) || !UUID_RE.test(questionId) || !Number.isInteger(optionIndex)) return { ok: false };
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.studentId, user.id)))
    .limit(1);
  if (!attempt || attempt.submittedAt || Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS) return { ok: false };
  const [qq] = await db
    .select({ options: quizQuestions.options })
    .from(quizQuestions)
    .where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, attempt.quizId)))
    .limit(1);
  if (!qq || optionIndex < 0 || optionIndex >= qq.options.length) return { ok: false };
  await db
    .update(quizAttempts)
    .set({ answers: sql`${quizAttempts.answers} || ${JSON.stringify({ [questionId]: optionIndex })}::jsonb` })
    .where(and(eq(quizAttempts.id, attemptId), sql`${quizAttempts.submittedAt} is null`));
  return { ok: true };
}

export async function submitQuizAction(quizId: string, formData: FormData) {
  const user = await requireStudent();
  const q = await eligibleQuiz(user, quizId);
  if (!q) redirect("/dashboard/quizzes");
  const back = `/dashboard/quizzes/${q.id}`;
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, q.id), eq(quizAttempts.studentId, user.id)))
    .limit(1);
  if (!attempt) redirect(back);
  if (!attempt.submittedAt) {
    const late = Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS;
    let answers = attempt.answers ?? {};
    if (!late) {
      // වේලාවට ඉදිරිපත් කළ විට form එකේ පිළිතුරු (සුරැකි ඒවාට වඩා අලුත්) ද සලකයි
      const questions = await db.select({ id: quizQuestions.id, n: sql<number>`jsonb_array_length(${quizQuestions.options})` }).from(quizQuestions).where(eq(quizQuestions.quizId, q.id));
      answers = { ...answers };
      for (const qq of questions) {
        const raw = formData.get(`q_${qq.id}`);
        if (raw === null) continue;
        const i = Number(raw);
        if (Number.isInteger(i) && i >= 0 && i < Number(qq.n)) answers[qq.id] = i;
      }
    }
    await finalizeAttempt(attempt.id, answers);
    await audit(user.id, "quiz.submit", q.title, late ? "late" : undefined, user.id);
    await notifyAdmins("QUIZ_SUBMITTED", { id: q.id, title: q.title, name: user.name });
  }
  refresh();
  redirect(withNotice(back, "submitted"));
}

export async function uploadSubmissionAction(prev: FormState, fd: FormData): Promise<FormState> {
  return localized(await uploadSubmissionImpl(prev, fd));
}

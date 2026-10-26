import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assignments, quizAttempts, quizzes, submissions, users } from "@/db/schema";
import { MEDIUM_LABELS, gradeGroup, gradeLabel } from "@/lib/constants";
import { csvResponse } from "@/lib/csv";
import { getT } from "@/lib/i18n/server";
import { parseProgressFilters } from "@/lib/progress-filters";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// ලකුණු පත්‍රිකාව: සිසුන් (පේළි) × Quiz සහ පැවරුම් (තීරු). ?grade=10&medium=SINHALA
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return new Response("Forbidden", { status: 403 });
  const t = await getT();
  const f = parseProgressFilters(Object.fromEntries(new URL(request.url).searchParams));
  const grades = f.grade ? gradeGroup(f.grade) : null;

  const sConds = [eq(users.role, "STUDENT"), eq(users.status, "ACTIVE")];
  if (f.grade) sConds.push(eq(users.grade, f.grade));
  if (f.medium) sConds.push(eq(users.medium, f.medium));
  const qConds = [eq(quizzes.isPublished, true)];
  const aConds = [eq(assignments.isPublished, true)];
  if (grades) { qConds.push(inArray(quizzes.grade, grades)); aConds.push(inArray(assignments.grade, grades)); }
  if (f.medium) { qConds.push(eq(quizzes.medium, f.medium)); aConds.push(eq(assignments.medium, f.medium)); }

  const [students, qs, as] = await Promise.all([
    db.select({ id: users.id, name: users.name, indexNo: users.indexNo, grade: users.grade, alYear: users.alYear, medium: users.medium }).from(users).where(and(...sConds)).orderBy(asc(users.grade), asc(users.name)),
    db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(and(...qConds)).orderBy(asc(quizzes.opensAt)),
    db.select({ id: assignments.id, title: assignments.title, maxMarks: assignments.maxMarks }).from(assignments).where(and(...aConds)).orderBy(asc(assignments.dueAt)),
  ]);
  const ids = students.map((s) => s.id);
  const [atts, subs] = ids.length
    ? await Promise.all([
        db.select({ studentId: quizAttempts.studentId, quizId: quizAttempts.quizId, score: quizAttempts.score, total: quizAttempts.total, submittedAt: quizAttempts.submittedAt }).from(quizAttempts).where(inArray(quizAttempts.studentId, ids)),
        db.select({ studentId: submissions.studentId, assignmentId: submissions.assignmentId, marks: submissions.marks, gradedAt: submissions.gradedAt }).from(submissions).where(inArray(submissions.studentId, ids)),
      ])
    : [[], []];
  const att = new Map(atts.map((a) => [`${a.studentId}:${a.quizId}`, a]));
  const sub = new Map(subs.map((s) => [`${s.studentId}:${s.assignmentId}`, s]));

  const header = [t("Index අංකය"), t("නම"), t("ශ්‍රේණිය"), t("මාධ්‍යය"), ...qs.map((q) => `Quiz: ${q.title}`), ...as.map((a) => `${t("පැවරුම")}: ${a.title}${a.maxMarks ? ` (/${a.maxMarks})` : ""}`)];
  const rows = students.map((s) => [
    s.indexNo ?? "",
    s.name,
    gradeLabel(s.grade, s.alYear, t),
    s.medium ? t(MEDIUM_LABELS[s.medium]) : "",
    ...qs.map((q) => {
      const a = att.get(`${s.id}:${q.id}`);
      return a?.submittedAt && a.total ? `${a.score}/${a.total}` : "";
    }),
    ...as.map((x) => {
      const r = sub.get(`${s.id}:${x.id}`);
      return r ? (r.gradedAt && r.marks !== null ? r.marks : t("ඉදිරිපත් කළා")) : "";
    }),
  ]);
  return csvResponse(header, rows, `marks-${new Date().toISOString().slice(0, 10)}.csv`);
}

import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assignments, lessonViews, lessons, quizAttempts, quizzes, submissions, users } from "@/db/schema";
import { gradeGroup } from "./constants";

// මෙම දින ගණනක් කිසිදු ක්‍රියාකාරකමක් නැත්නම් සිසුවා "නිෂ්ක්‍රීය" වේ
export const INACTIVE_DAYS = 7;
export const WEAK_PCT = 50; // මෙයට අඩු Quiz ලකුණු "දුර්වල" ලෙස සලකයි

const DAY = 86_400_000;

// සිසුවා පාඩමක් / Tute එකක් විවෘත කළ බව සටහන් කරයි (පිටුව විවෘත වීම කිසිවිටෙක මෙමගින් අසාර්ථක නොවේ)
export async function recordLessonView(userId: string, lessonId: string) {
  try {
    await db
      .insert(lessonViews)
      .values({ userId, lessonId })
      .onConflictDoUpdate({ target: [lessonViews.userId, lessonViews.lessonId], set: { lastViewedAt: new Date(), views: sql`${lessonViews.views} + 1` } });
  } catch (e) {
    console.error("recordLessonView failed", e);
  }
}

export type ProgressFilters = { grade?: number | null; medium?: "SINHALA" | "ENGLISH" | null; inactiveOnly?: boolean };

export type ProgressRow = {
  id: string;
  name: string;
  indexNo: string | null;
  grade: number;
  alYear: number | null;
  medium: "SINHALA" | "ENGLISH" | null;
  phone: string;
  lessonsViewed: number;
  lessonsTotal: number;
  quizzesDone: number;
  quizzesTotal: number;
  quizPct: number | null; // සම්පූර්ණ කළ සියලු Quiz වල සාමාන්‍ය ලකුණු %
  asgDone: number;
  asgTotal: number;
  lastActivity: Date | null; // Login / පාඩම් / Quiz / පැවරුම් වලින් අලුත්ම
  neverActive: boolean;
  inactive: boolean;
};

const pct = (score: number, total: number) => (total > 0 ? Math.round((score / total) * 100) : 0);

// සක්‍රිය සිසුන්ගේ ප්‍රගතිය (පාඩම් බැලීම, Quiz, පැවරුම්) සහ අවසන් ක්‍රියාකාරකම
export async function loadProgress(filters: ProgressFilters, nowTs = Date.now()): Promise<ProgressRow[]> {
  const conds = [eq(users.role, "STUDENT"), eq(users.status, "ACTIVE")];
  if (filters.grade) conds.push(eq(users.grade, filters.grade));
  if (filters.medium) conds.push(eq(users.medium, filters.medium));
  const students = await db
    .select({ id: users.id, name: users.name, indexNo: users.indexNo, grade: users.grade, alYear: users.alYear, medium: users.medium, phone: users.phone, instituteId: users.instituteId, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .where(and(...conds))
    .orderBy(asc(users.grade), asc(users.name));
  if (students.length === 0) return [];
  const ids = students.map((s) => s.id);

  const [lessonRows, quizRows, asgRows, views, attempts, subs] = await Promise.all([
    db.select({ id: lessons.id, grade: lessons.grade, medium: lessons.medium }).from(lessons).where(and(eq(lessons.isPublished, true), eq(lessons.kind, "LESSON"))),
    db.select({ id: quizzes.id, grade: quizzes.grade, medium: quizzes.medium, instituteId: quizzes.instituteId }).from(quizzes).where(eq(quizzes.isPublished, true)),
    db.select({ id: assignments.id, grade: assignments.grade, medium: assignments.medium, instituteId: assignments.instituteId }).from(assignments).where(eq(assignments.isPublished, true)),
    db
      .select({ userId: lessonViews.userId, lessonId: lessonViews.lessonId, last: lessonViews.lastViewedAt })
      .from(lessonViews)
      .where(inArray(lessonViews.userId, ids)),
    db
      .select({ studentId: quizAttempts.studentId, quizId: quizAttempts.quizId, score: quizAttempts.score, total: quizAttempts.total, startedAt: quizAttempts.startedAt, submittedAt: quizAttempts.submittedAt })
      .from(quizAttempts)
      .where(inArray(quizAttempts.studentId, ids)),
    db.select({ studentId: submissions.studentId, assignmentId: submissions.assignmentId, at: submissions.submittedAt }).from(submissions).where(inArray(submissions.studentId, ids)),
  ]);

  const lessonIdsFor = (grade: number, medium: string | null) => {
    const g = gradeGroup(grade);
    return new Set(lessonRows.filter((l) => g.includes(l.grade) && l.medium === medium).map((l) => l.id));
  };
  const eligible = <T extends { grade: number; medium: string; instituteId: string | null }>(rows: T[], s: (typeof students)[number]) => {
    const g = gradeGroup(s.grade);
    return rows.filter((r) => g.includes(r.grade) && r.medium === s.medium && (r.instituteId === null || r.instituteId === s.instituteId));
  };

  const byUser = <T extends { studentId?: string; userId?: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = (r.studentId ?? r.userId)!;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  };
  const viewsBy = byUser(views);
  const attemptsBy = byUser(attempts);
  const subsBy = byUser(subs);
  const cutoff = nowTs - INACTIVE_DAYS * DAY;

  const rows: ProgressRow[] = students.map((s) => {
    const myLessons = lessonIdsFor(s.grade, s.medium);
    const myViews = viewsBy.get(s.id) ?? [];
    const myAttempts = attemptsBy.get(s.id) ?? [];
    const mySubs = subsBy.get(s.id) ?? [];
    const myQuizzes = new Set(eligible(quizRows, s).map((q) => q.id));
    const myAsgs = new Set(eligible(asgRows, s).map((a) => a.id));
    const done = myAttempts.filter((a) => a.submittedAt && a.total !== null);
    const sumScore = done.reduce((n, a) => n + (a.score ?? 0), 0);
    const sumTotal = done.reduce((n, a) => n + (a.total ?? 0), 0);
    const stamps = [
      s.lastLoginAt?.getTime(),
      ...myViews.map((v) => v.last.getTime()),
      ...myAttempts.map((a) => a.startedAt.getTime()),
      ...mySubs.map((x) => x.at.getTime()),
    ].filter((x): x is number => typeof x === "number");
    const last = stamps.length ? new Date(Math.max(...stamps)) : null;
    const reference = last ? last.getTime() : s.createdAt.getTime();
    return {
      id: s.id,
      name: s.name,
      indexNo: s.indexNo,
      grade: s.grade,
      alYear: s.alYear,
      medium: s.medium,
      phone: s.phone,
      lessonsViewed: new Set(myViews.filter((v) => myLessons.has(v.lessonId)).map((v) => v.lessonId)).size,
      lessonsTotal: myLessons.size,
      quizzesDone: done.filter((a) => myQuizzes.has(a.quizId)).length,
      quizzesTotal: myQuizzes.size,
      quizPct: sumTotal > 0 ? pct(sumScore, sumTotal) : null,
      asgDone: mySubs.filter((x) => myAsgs.has(x.assignmentId)).length,
      asgTotal: myAsgs.size,
      lastActivity: last,
      neverActive: !last,
      inactive: reference < cutoff,
    };
  });
  return filters.inactiveOnly ? rows.filter((r) => r.inactive) : rows;
}

// පන්තියේ සාමාන්‍ය ලකුණු අඩුම Quiz (දුර්වල ප්‍රදේශ හඳුනා ගැනීමට)
export async function weakQuizzes(filters: ProgressFilters, limit = 5) {
  const conds = [sql`${quizAttempts.submittedAt} is not null`, sql`${quizAttempts.total} > 0`];
  if (filters.grade) conds.push(eq(quizzes.grade, filters.grade));
  if (filters.medium) conds.push(eq(quizzes.medium, filters.medium));
  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      grade: quizzes.grade,
      attempts: sql<number>`count(*)::int`,
      avgPct: sql<number>`round(100.0 * sum(${quizAttempts.score}) / sum(${quizAttempts.total}))::int`,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .where(and(...conds))
    .groupBy(quizzes.id, quizzes.title, quizzes.grade)
    .orderBy(sql`round(100.0 * sum(${quizAttempts.score}) / sum(${quizAttempts.total})) asc`)
    .limit(limit);
  return rows.filter((r) => r.avgPct < 60);
}

// එක් සිසුවෙකුගේ සවිස්තර ප්‍රගතිය (Admin ගේ සිසුවාගේ පිටුව සඳහා)
export async function loadStudentProgress(studentId: string) {
  const [s] = await db.select({ grade: users.grade, medium: users.medium, instituteId: users.instituteId }).from(users).where(eq(users.id, studentId)).limit(1);
  if (!s || !s.medium) return null;
  const group = gradeGroup(s.grade);
  const [lessonList, viewRows, attemptRows, asgList, subRows] = await Promise.all([
    db
      .select({ id: lessons.id, title: lessons.title, order: lessons.order, grade: lessons.grade })
      .from(lessons)
      .where(and(inArray(lessons.grade, group), eq(lessons.medium, s.medium), eq(lessons.kind, "LESSON"), eq(lessons.isPublished, true)))
      .orderBy(asc(lessons.grade), asc(lessons.order)),
    db.select({ lessonId: lessonViews.lessonId, last: lessonViews.lastViewedAt, views: lessonViews.views }).from(lessonViews).where(eq(lessonViews.userId, studentId)),
    db
      .select({ quizId: quizAttempts.quizId, title: quizzes.title, score: quizAttempts.score, total: quizAttempts.total, submittedAt: quizAttempts.submittedAt, startedAt: quizAttempts.startedAt })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(eq(quizAttempts.studentId, studentId))
      .orderBy(asc(quizAttempts.startedAt)),
    db
      .select({ id: assignments.id, title: assignments.title, dueAt: assignments.dueAt, maxMarks: assignments.maxMarks, instituteId: assignments.instituteId })
      .from(assignments)
      .where(and(inArray(assignments.grade, group), eq(assignments.medium, s.medium), eq(assignments.isPublished, true)))
      .orderBy(desc(assignments.dueAt)),
    db.select({ assignmentId: submissions.assignmentId, marks: submissions.marks, at: submissions.submittedAt, gradedAt: submissions.gradedAt }).from(submissions).where(eq(submissions.studentId, studentId)),
  ]);
  const viewOf = new Map(viewRows.map((v) => [v.lessonId, v]));
  const subOf = new Map(subRows.map((x) => [x.assignmentId, x]));
  const quizScores = attemptRows
    .filter((a) => a.submittedAt && a.total)
    .map((a) => ({ quizId: a.quizId, title: a.title, score: a.score ?? 0, total: a.total ?? 0, pct: pct(a.score ?? 0, a.total ?? 0), at: a.submittedAt as Date }));
  return {
    lessons: lessonList.map((l) => ({ ...l, viewedAt: viewOf.get(l.id)?.last ?? null, views: viewOf.get(l.id)?.views ?? 0 })),
    quizScores,
    weak: quizScores.filter((q) => q.pct < WEAK_PCT),
    assignments: asgList
      .filter((a) => a.instituteId === null || a.instituteId === s.instituteId)
      .map((a) => ({ id: a.id, title: a.title, dueAt: a.dueAt, maxMarks: a.maxMarks, sub: subOf.get(a.id) ?? null })),
  };
}

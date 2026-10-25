import "server-only";
import { and, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { quizAttempts, quizQuestions } from "@/db/schema";
import { gradeGroup } from "./constants";
import type { SessionUser } from "./session";

// සිසුවා අයත් ශ්‍රේණිය (10 ↔ 11 එකිනෙකා බෙදාගනී) + මාධ්‍යය (+ ආයතනය) ට පවරා ඇති දේවල් පමණක් තෝරන where කොටස.
// table එකක columns: grade, medium, instituteId, isPublished
export function eligibleFor(
  user: Pick<SessionUser, "grade" | "medium" | "instituteId">,
  cols: { grade: any; medium: any; instituteId: any; isPublished: any }, // eslint-disable-line @typescript-eslint/no-explicit-any
): SQL | undefined {
  if (!user.medium) return sql`false`;
  return and(
    eq(cols.isPublished, true),
    inArray(cols.grade, gradeGroup(user.grade)),
    eq(cols.medium, user.medium),
    user.instituteId ? or(isNull(cols.instituteId), eq(cols.instituteId, user.instituteId)) : isNull(cols.instituteId),
  );
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ඉදිරිපත් කිරීමෙන් පසු ද server එකේ ආරක්ෂිත කාල ඉඩ (network ප්‍රමාදය සඳහා)
export const SUBMIT_GRACE_MS = 20_000;

// Quiz එකක් සම්පූර්ණ කර ලකුණු ගණනය කරයි (දැනටමත් ඉදිරිපත් කර ඇත්නම් කිසිවක් නොකරයි)
export async function finalizeAttempt(attemptId: string, answersOverride?: Record<string, number>) {
  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1);
  if (!attempt || attempt.submittedAt) return attempt ?? null;
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, attempt.quizId));
  const answers = answersOverride ?? attempt.answers ?? {};
  let score = 0;
  let total = 0;
  for (const q of questions) {
    total += q.marks;
    if (answers[q.id] === q.correctIndex) score += q.marks;
  }
  const [row] = await db
    .update(quizAttempts)
    .set({ answers, score, total, submittedAt: new Date() })
    .where(and(eq(quizAttempts.id, attemptId), isNull(quizAttempts.submittedAt)))
    .returning();
  return row ?? (await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1))[0] ?? null;
}

// කාලය ඉකුත් වී ඇති (නමුත් ඉදිරිපත් නොකළ) උත්සාහයන් ස්වයංක්‍රීයව සම්පූර්ණ කරයි.
// scope: නිශ්චිත Quiz එකක් හෝ සිසුවෙකුගේ උත්සාහයන්
export async function finalizeExpired(scope: { quizId?: string; studentId?: string }) {
  const conds = [isNull(quizAttempts.submittedAt), lt(quizAttempts.deadlineAt, new Date(Date.now() - SUBMIT_GRACE_MS))];
  if (scope.quizId) conds.push(eq(quizAttempts.quizId, scope.quizId));
  if (scope.studentId) conds.push(eq(quizAttempts.studentId, scope.studentId));
  const stale = await db.select({ id: quizAttempts.id }).from(quizAttempts).where(and(...conds));
  for (const a of stale) await finalizeAttempt(a.id);
}

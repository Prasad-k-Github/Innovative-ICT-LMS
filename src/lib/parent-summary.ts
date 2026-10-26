import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { assignments, lessonViews, quizAttempts, quizzes, submissions, users } from "@/db/schema";
import { gradeGroup, gradeLabel } from "./constants";
import { loadProgress } from "./progress";
import { hmac } from "./secrets";
import { appUrl, sendParentSummaryEmail } from "./mail";
import { timingSafeEqual } from "node:crypto";

const DAY = 86_400_000;

export type WeeklySummary = {
  studentId: string;
  name: string;
  grade: number;
  alYear: number | null;
  lessonsThisWeek: number;
  quizzes: { title: string; score: number; total: number }[];
  asgSubmitted: number;
  asgPending: { title: string; dueAt: Date }[];
  asgOverdue: number;
  lastActivity: Date | null;
  inactive: boolean;
};

// පසුගිය දින 7 සඳහා සිසුන්ගේ සාරාංශ (බහු සිසුන් එකවර, query ගණන ස්ථිර)
export async function loadWeeklySummaries(ids: string[], nowTs = Date.now()): Promise<Map<string, WeeklySummary>> {
  const out = new Map<string, WeeklySummary>();
  if (ids.length === 0) return out;
  const since = new Date(nowTs - 7 * DAY);
  const now = new Date(nowTs);
  const [studs, views, attempts, asgs, subs, progress] = await Promise.all([
    db.select({ id: users.id, name: users.name, grade: users.grade, alYear: users.alYear, medium: users.medium, instituteId: users.instituteId }).from(users).where(inArray(users.id, ids)),
    db.select({ userId: lessonViews.userId, lessonId: lessonViews.lessonId }).from(lessonViews).where(and(inArray(lessonViews.userId, ids), gte(lessonViews.lastViewedAt, since))),
    db
      .select({ studentId: quizAttempts.studentId, title: quizzes.title, score: quizAttempts.score, total: quizAttempts.total })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(and(inArray(quizAttempts.studentId, ids), isNotNull(quizAttempts.submittedAt), gte(quizAttempts.submittedAt, since)))
      .orderBy(asc(quizAttempts.submittedAt)),
    db
      .select({ id: assignments.id, title: assignments.title, grade: assignments.grade, medium: assignments.medium, instituteId: assignments.instituteId, dueAt: assignments.dueAt })
      .from(assignments)
      .where(and(eq(assignments.isPublished, true), or(gte(assignments.dueAt, now), gte(assignments.dueAt, new Date(nowTs - 30 * DAY))))),
    db.select({ studentId: submissions.studentId, assignmentId: submissions.assignmentId, at: submissions.submittedAt }).from(submissions).where(inArray(submissions.studentId, ids)),
    loadProgress({ ids }, nowTs),
  ]);
  const prog = new Map(progress.map((p) => [p.id, p]));
  for (const s of studs) {
    const g = gradeGroup(s.grade);
    const mine = asgs.filter((a) => g.includes(a.grade) && a.medium === s.medium && (a.instituteId === null || a.instituteId === s.instituteId));
    const mySubs = subs.filter((x) => x.studentId === s.id);
    const done = new Set(mySubs.map((x) => x.assignmentId));
    const p = prog.get(s.id);
    out.set(s.id, {
      studentId: s.id,
      name: s.name,
      grade: s.grade,
      alYear: s.alYear,
      lessonsThisWeek: new Set(views.filter((v) => v.userId === s.id).map((v) => v.lessonId)).size,
      quizzes: attempts.filter((a) => a.studentId === s.id && a.total).map((a) => ({ title: a.title, score: a.score ?? 0, total: a.total ?? 0 })),
      asgSubmitted: mySubs.filter((x) => x.at >= since).length,
      asgPending: mine.filter((a) => !done.has(a.id) && a.dueAt > now).sort((x, y) => x.dueAt.getTime() - y.dueAt.getTime()).slice(0, 3).map((a) => ({ title: a.title, dueAt: a.dueAt })),
      asgOverdue: mine.filter((a) => !done.has(a.id) && a.dueAt <= now).length,
      lastActivity: p?.lastActivity ?? null,
      inactive: p?.inactive ?? false,
    });
  }
  return out;
}

const fmtDate = (d: Date, locale: string) => d.toLocaleDateString(locale, { timeZone: "Asia/Colombo", day: "numeric", month: "short" });

// WhatsApp / පෙළ පණිවිඩය (සිංහල)
export function summaryTextSi(s: WeeklySummary): string {
  const gl = gradeLabel(s.grade, s.alYear);
  const lines = [`📘 Innovative ICT - සතිපතා ප්‍රගති සාරාංශය`, `${s.name} (${gl})`, ""];
  lines.push(`• බැලූ පාඩම්: ${s.lessonsThisWeek}`);
  if (s.quizzes.length) lines.push(`• Quiz: ${s.quizzes.map((q) => `${q.title} ${q.score}/${q.total}`).join(", ")}`);
  else lines.push("• මෙම සතියේ Quiz සම්පූර්ණ කර නැත");
  lines.push(`• ඉදිරිපත් කළ පැවරුම්: ${s.asgSubmitted}`);
  if (s.asgPending.length) lines.push(`• ඉදිරිපත් කළ යුතු පැවරුම්: ${s.asgPending.map((a) => `${a.title} (${fmtDate(a.dueAt, "si-LK")})`).join(", ")}`);
  if (s.asgOverdue) lines.push(`• කාලය ඉකුත් වූ, ඉදිරිපත් නොකළ පැවරුම්: ${s.asgOverdue}`);
  if (s.inactive) lines.push("", "⚠️ මෙම සතියේ පද්ධතිය භාවිතා කර නැත. කරුණාකර අධ්‍යයන කටයුතු සඳහා දිරිමත් කරන්න.");
  return lines.join("\n");
}

export function summaryTextEn(s: WeeklySummary): string {
  const gl = gradeLabel(s.grade, s.alYear, (k, v) => (k === "{n} ශ්‍රේණිය" ? `Grade ${v?.n}` : k === "උසස් පෙළ {year}" ? `A/L ${v?.year}` : "A/L"));
  const lines = [`Innovative ICT - weekly progress summary`, `${s.name} (${gl})`, ""];
  lines.push(`- Lessons viewed: ${s.lessonsThisWeek}`);
  lines.push(s.quizzes.length ? `- Quizzes: ${s.quizzes.map((q) => `${q.title} ${q.score}/${q.total}`).join(", ")}` : "- No quizzes completed this week");
  lines.push(`- Assignments submitted: ${s.asgSubmitted}`);
  if (s.asgPending.length) lines.push(`- Assignments due: ${s.asgPending.map((a) => `${a.title} (${fmtDate(a.dueAt, "en-GB")})`).join(", ")}`);
  if (s.asgOverdue) lines.push(`- Overdue and not submitted: ${s.asgOverdue}`);
  if (s.inactive) lines.push("", "Note: no activity on the platform this week.");
  return lines.join("\n");
}

// WhatsApp click-to-send ලිපිනය (0XXXXXXXXX -> 94XXXXXXXXX)
export function whatsappLink(phone: string, text: string): string {
  const intl = phone.startsWith("0") ? `94${phone.slice(1)}` : phone;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

// Unsubscribe link (HMAC අත්සන: ලොග් වීමක් අවශ්‍ය නැත, වෙනත් අයට අනුමාන කළ නොහැක)
export function unsubscribeSig(studentId: string) {
  return hmac("parent-unsubscribe", studentId);
}
export function verifyUnsubscribe(studentId: string, sig: string) {
  const a = Buffer.from(unsubscribeSig(studentId));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const unsubscribeUrl = (studentId: string) => `${appUrl()}/parent/unsubscribe?u=${encodeURIComponent(studentId)}&s=${unsubscribeSig(studentId)}`;

// එකඟ වී ඇති සියලු දෙමාපියන්ට Email සාරාංශ යවයි (සිසුවෙකුට දින 6කට වරක් පමණි). cron සහ Admin බොත්තම දෙකම භාවිතා කරයි
export async function sendWeeklySummaries(limit = 200, nowTs = Date.now()) {
  const due = await db
    .select({ id: users.id, parentEmail: users.parentEmail })
    .from(users)
    .where(
      and(
        eq(users.role, "STUDENT"),
        eq(users.status, "ACTIVE"),
        isNotNull(users.parentOptInAt),
        isNotNull(users.parentEmail),
        or(isNull(users.parentSummarySentAt), lt(users.parentSummarySentAt, new Date(nowTs - 6 * DAY))),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
  const summaries = await loadWeeklySummaries(due.map((d) => d.id), nowTs);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < due.length; i += 5) {
    await Promise.all(
      due.slice(i, i + 5).map(async (d) => {
        const s = summaries.get(d.id);
        if (!s || !d.parentEmail) return;
        try {
          await sendParentSummaryEmail(d.parentEmail, s.name, summaryTextSi(s), summaryTextEn(s), unsubscribeUrl(d.id));
          await db.update(users).set({ parentSummarySentAt: new Date(nowTs) }).where(eq(users.id, d.id));
          sent++;
        } catch (e) {
          console.error("parent summary email failed", e);
          failed++;
        }
      }),
    );
  }
  return { sent, failed, total: due.length };
}

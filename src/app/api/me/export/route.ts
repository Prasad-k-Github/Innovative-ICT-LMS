import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  agentMessages,
  agentWallets,
  assignments,
  changeRequests,
  chatMessages,
  forumPosts,
  forumThreads,
  institutes,
  lessonViews,
  lessons,
  notifications,
  quizAttempts,
  quizzes,
  submissionFiles,
  submissions,
  testimonials,
  users,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// සිසුවාගේ සියලු දත්ත JSON file එකක් ලෙස බාගැනීම (තමාගේම දත්ත පමණි). මුරපද hash, 2-step රහස්, session tokens ඇතුළත් නොවේ
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "STUDENT") return new Response("Forbidden", { status: 403 });
  if (!(await rateLimit(`data-export:${me.id}`, 5, 60 * 60_000))) return new Response("Too many requests", { status: 429 });

  const [profile] = await db
    .select({
      indexNo: users.indexNo,
      name: users.name,
      school: users.school,
      grade: users.grade,
      alYear: users.alYear,
      medium: users.medium,
      phone: users.phone,
      email: users.email,
      institute: institutes.name,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      consentAt: users.consentAt,
      consentVersion: users.consentVersion,
      parentEmail: users.parentEmail,
      parentPhone: users.parentPhone,
      parentOptInAt: users.parentOptInAt,
      parentUnsubscribedAt: users.parentUnsubscribedAt,
    })
    .from(users)
    .leftJoin(institutes, eq(institutes.id, users.instituteId))
    .where(eq(users.id, me.id))
    .limit(1);

  const [views, attempts, subs, wallet, agent, threads, posts, chat, testi, notifs, requests] = await Promise.all([
    db.select({ lesson: lessons.title, firstViewedAt: lessonViews.firstViewedAt, lastViewedAt: lessonViews.lastViewedAt, views: lessonViews.views }).from(lessonViews).innerJoin(lessons, eq(lessons.id, lessonViews.lessonId)).where(eq(lessonViews.userId, me.id)),
    db.select({ quiz: quizzes.title, startedAt: quizAttempts.startedAt, submittedAt: quizAttempts.submittedAt, score: quizAttempts.score, total: quizAttempts.total, answers: quizAttempts.answers }).from(quizAttempts).innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId)).where(eq(quizAttempts.studentId, me.id)),
    db.select({ id: submissions.id, assignment: assignments.title, note: submissions.note, marks: submissions.marks, feedback: submissions.feedback, submittedAt: submissions.submittedAt, gradedAt: submissions.gradedAt }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(eq(submissions.studentId, me.id)),
    db.select({ balance: agentWallets.balance, granted: agentWallets.granted, used: agentWallets.used }).from(agentWallets).where(eq(agentWallets.userId, me.id)),
    db.select({ conversationId: agentMessages.conversationId, role: agentMessages.role, content: agentMessages.content, createdAt: agentMessages.createdAt }).from(agentMessages).where(eq(agentMessages.userId, me.id)).orderBy(agentMessages.createdAt),
    db.select({ room: forumThreads.room, title: forumThreads.title, body: forumThreads.body, createdAt: forumThreads.createdAt }).from(forumThreads).where(eq(forumThreads.authorId, me.id)),
    db.select({ body: forumPosts.body, createdAt: forumPosts.createdAt }).from(forumPosts).where(eq(forumPosts.authorId, me.id)),
    db.select({ room: chatMessages.room, body: chatMessages.body, createdAt: chatMessages.createdAt }).from(chatMessages).where(eq(chatMessages.authorId, me.id)),
    db.select({ authorName: testimonials.authorName, quote: testimonials.quote, status: testimonials.status }).from(testimonials).where(eq(testimonials.submittedBy, me.id)),
    db.select({ type: notifications.type, data: notifications.data, createdAt: notifications.createdAt, readAt: notifications.readAt }).from(notifications).where(eq(notifications.userId, me.id)).orderBy(desc(notifications.createdAt)).limit(500),
    db.select({ grade: changeRequests.grade, medium: changeRequests.medium, status: changeRequests.status, note: changeRequests.note, createdAt: changeRequests.createdAt }).from(changeRequests).where(eq(changeRequests.userId, me.id)),
  ]);
  const files = subs.length
    ? await db.select({ submissionId: submissionFiles.submissionId, filename: submissionFiles.filename, size: submissionFiles.size }).from(submissionFiles).where(inArray(submissionFiles.submissionId, subs.map((s) => s.id)))
    : [];

  await audit(me.id, "student.data_export", me.email, undefined, me.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    note: "Your personal data held by Innovative ICT. Password hashes, 2-step secrets and session tokens are never included.",
    profile,
    lessonViews: views,
    quizAttempts: attempts,
    assignmentSubmissions: subs.map(({ id, ...s }) => ({ ...s, files: files.filter((f) => f.submissionId === id).map((f) => ({ filename: f.filename, size: f.size })) })),
    ictBuddy: { wallet: wallet[0] ?? null, messages: agent },
    community: { threads, replies: posts, chatMessages: chat },
    testimonials: testi,
    notifications: notifs,
    changeRequests: requests,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

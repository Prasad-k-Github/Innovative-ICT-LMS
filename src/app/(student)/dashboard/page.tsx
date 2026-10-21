import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { assignments, lessons, quizAttempts, quizzes, resources, submissions } from "@/db/schema";
import { eligibleFor } from "@/lib/assessment";
import { CONTENT_TYPE_LABELS, GENERAL_TYPES, LESSON_TYPES, MEDIUM_LABELS, gradeLabel, type ContentType } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/time";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const ICONS: Record<ContentType, string> = {
  TEXTBOOK: "📘",
  WORKBOOK: "📒",
  TUTE: "📄",
  ESSAY: "✍️",
  NOTE: "📎",
  RECORDING: "🎬",
  PAST_PAPER: "📝",
  MODEL_PAPER: "🧪",
};

const linkClass =
  "flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-primary hover:bg-primary-soft";

export default async function DashboardPage() {
  // අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්ට layout එකෙන් පණිවිඩය පෙන්වයි
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getT();

  // සිසුවාගේ ශ්‍රේණිය සහ මාධ්‍යයට අදාළ, සිසුන්ට පෙනෙන (published) අන්තර්ගතය පමණි
  const medium = user.medium;
  const [lessonRows, files] = medium
    ? await Promise.all([
        db
          .select()
          .from(lessons)
          .where(and(eq(lessons.grade, user.grade), eq(lessons.medium, medium), eq(lessons.isPublished, true)))
          .orderBy(asc(lessons.order), asc(lessons.title)),
        db
          .select()
          .from(resources)
          .where(and(eq(resources.grade, user.grade), eq(resources.medium, medium), eq(resources.isPublished, true)))
          .orderBy(desc(resources.year), asc(resources.createdAt)),
      ])
    : [[], []];

  // කළ යුතු පැවරුම් සහ විවෘත Quiz සාරාංශය
  const [asg, mySubs, qz, myAtt] = medium
    ? await Promise.all([
        db.select({ id: assignments.id, dueAt: assignments.dueAt }).from(assignments).where(eligibleFor(user, assignments)),
        db.select({ assignmentId: submissions.assignmentId }).from(submissions).where(eq(submissions.studentId, user.id)),
        db.select({ id: quizzes.id, opensAt: quizzes.opensAt, closesAt: quizzes.closesAt }).from(quizzes).where(eligibleFor(user, quizzes)),
        db.select({ quizId: quizAttempts.quizId, submittedAt: quizAttempts.submittedAt }).from(quizAttempts).where(eq(quizAttempts.studentId, user.id)),
      ])
    : [[], [], [], []];
  const nowTs = nowMs();
  const doneAsg = new Set(mySubs.map((x) => x.assignmentId));
  const doneQuiz = new Set(myAtt.filter((x) => x.submittedAt).map((x) => x.quizId));
  const pendingAsg = asg.filter((a) => a.dueAt.getTime() > nowTs && !doneAsg.has(a.id)).length;
  const openQuiz = qz.filter((q) => q.opensAt.getTime() <= nowTs && q.closesAt.getTime() > nowTs && !doneQuiz.has(q.id)).length;

  const byLesson = new Map<string, typeof files>();
  for (const f of files) {
    if (!f.lessonId) continue;
    byLesson.set(f.lessonId, [...(byLesson.get(f.lessonId) ?? []), f]);
  }
  const general = files.filter((f) => !f.lessonId && GENERAL_TYPES.includes(f.type));
  const generalGroups = GENERAL_TYPES.map((type) => ({ type, items: general.filter((f) => f.type === type) })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      {/* ආයුබෝවන් පුවරුව: navy පසුබිම, ශ්‍රේණිය/මාධ්‍යය, සහ කළ යුතු දේ */}
      <section className="pixel-grid relative overflow-hidden rounded-[1.75rem] bg-navy-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{t("ආයුබෝවන්, {name}", { name: user.name })}</h1>
            <p className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-full bg-sun px-3 py-1 text-navy">{gradeLabel(user.grade, user.alYear, t)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">ICT</span>
              {medium && <span className="rounded-full bg-white/10 px-3 py-1">{t(MEDIUM_LABELS[medium])}</span>}
            </p>
          </div>
          {medium && (
            <div className="grid grid-cols-2 gap-3 lg:w-[26rem]">
              <Link href="/dashboard/assignments" className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 transition hover:bg-white/15">
                <p className="font-display text-4xl font-bold text-sun">{pendingAsg}</p>
                <p className="mt-1 text-sm leading-snug text-white/75">{t("ඉදිරිපත් කළ යුතු පැවරුම්")}</p>
              </Link>
              <Link href="/dashboard/quizzes" className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 transition hover:bg-white/15">
                <p className="font-display text-4xl font-bold text-sun">{openQuiz}</p>
                <p className="mt-1 text-sm leading-snug text-white/75">{t("විවෘත Quiz")}</p>
              </Link>
            </div>
          )}
        </div>
      </section>

      {!medium && (
        <Alert kind="warning">
          {t("ඔබගේ මාධ්‍යය තෝරා නැත.")}{" "}
          <Link href="/dashboard/profile" className="font-semibold underline">
            {t("මගේ ගිණුම")}
          </Link>{" "}
          {t("හි ඉල්ලීමක් යවන්න.")}
        </Alert>
      )}

      {medium && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">{t("පාඩම්")}</h2>
          {lessonRows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">{t("පාඩම් ඉක්මනින් එක් කෙරේ.")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lessonRows.map((l) => {
                const items = byLesson.get(l.id) ?? [];
                return (
                  <article key={l.id} className="card flex flex-col p-5">
                    <div className="flex items-start gap-4">
                      <span className="font-display text-5xl font-extrabold leading-none text-primary/20">{l.order}</span>
                      <div className="pt-0.5">
                        <p className="text-xs font-semibold text-primary">{t("පාඩම {n}", { n: l.order })}</p>
                        <h3 className="mt-0.5 font-semibold leading-snug">{l.title}</h3>
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-muted">{t("ඉක්මනින්")}</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {LESSON_TYPES.map((type) => {
                          const group = items.filter((i) => i.type === type);
                          if (!group.length) return null;
                          return (
                            <div key={type} className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted">{t(CONTENT_TYPE_LABELS[type])}</p>
                              {group.map((i) => (
                                <a key={i.id} href={i.driveUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                  <span aria-hidden="true">{ICONS[type]}</span>
                                  <span className="min-w-0 flex-1 truncate">{i.title || t(CONTENT_TYPE_LABELS[type])}</span>
                                  <span aria-hidden="true" className="text-muted">↗</span>
                                </a>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {generalGroups.map((g) => (
        <section key={g.type} className="space-y-3">
          <h2 className="text-xl font-bold">
            <span aria-hidden="true">{ICONS[g.type]}</span> {t(CONTENT_TYPE_LABELS[g.type])}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((i) => (
              <a key={i.id} href={i.driveUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <span className="min-w-0 flex-1 truncate">
                  {i.year ? `${i.year} · ` : ""}
                  {i.title || t(CONTENT_TYPE_LABELS[g.type])}
                </span>
                <span aria-hidden="true" className="text-muted">↗</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

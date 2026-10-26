import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { assignments, lessons, quizAttempts, quizzes, resources, submissions } from "@/db/schema";
import { eligibleFor } from "@/lib/assessment";
import { activeClassLinksFor } from "@/lib/class-links";
import { formatColombo } from "@/lib/time";
import { CONTENT_TYPE_LABELS, LESSON_PAGE_ORDER, MEDIUM_LABELS, gradeGroup, gradeLabel } from "@/lib/constants";
import { avatarUrlOf } from "@/lib/avatar";
import { AgentLogo, Avatar, Tile, TONES, ToneCard, toneAt } from "@/components/cards";
import { RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/time";
import { getCurrentUser } from "@/lib/session";
import { EmptyState } from "@/components/page-hero";
import { TuteCards } from "@/components/tute-cards";
import { GradeTabs, pickGrade } from "@/components/grade-tabs";
import { DashboardSearch } from "@/components/dashboard-search";
import { NewsletterCard } from "@/components/newsletter-card";
import { parseSearchParams } from "@/lib/student-search";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  // අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්ට layout එකෙන් පණිවිඩය පෙන්වයි
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getT();
  const avatar = await avatarUrlOf(user.id);

  // සිසුවාගේ ශ්‍රේණිය සහ මාධ්‍යයට අදාළ, සිසුන්ට පෙනෙන (published) අන්තර්ගතය පමණි
  const medium = user.medium;
  const [allLessonRows, files] = medium
    ? await Promise.all([
        db
          .select()
          .from(lessons)
          .where(and(inArray(lessons.grade, gradeGroup(user.grade)), eq(lessons.medium, medium), eq(lessons.isPublished, true)))
          .orderBy(asc(lessons.grade), asc(lessons.order), asc(lessons.title)),
        db
          .select()
          .from(resources)
          .where(and(inArray(resources.grade, gradeGroup(user.grade)), eq(resources.medium, medium), eq(resources.isPublished, true)))
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
  const liveClasses = await activeClassLinksFor(user, new Date(nowTs));
  const doneAsg = new Set(mySubs.map((x) => x.assignmentId));
  const doneQuiz = new Set(myAtt.filter((x) => x.submittedAt).map((x) => x.quizId));
  const pendingAsg = asg.filter((a) => a.dueAt.getTime() > nowTs && !doneAsg.has(a.id)).length;
  const openQuiz = qz.filter((q) => q.opensAt.getTime() <= nowTs && q.closesAt.getTime() > nowTs && !doneQuiz.has(q.id)).length;

  // O/L ශ්‍රේණි 10 සහ 11 සිසුන්ට දෙවර්ගයේම පාඩම් පෙනෙන නිසා ශ්‍රේණිය ලකුණු කරයි
  const shared = gradeGroup(user.grade).length > 1;
  const gradeTag = (g: number) => (shared ? gradeLabel(g, null, t) : "");
  const group = gradeGroup(user.grade);
  const sp = await props.searchParams;
  const picked = pickGrade(sp.g, group, user.grade);
  const searchParams = parseSearchParams(sp, group);
  const gradeCounts: Record<number, number> = {};
  for (const l of allLessonRows) gradeCounts[l.grade] = (gradeCounts[l.grade] ?? 0) + 1;
  const visibleRows = picked === null ? allLessonRows : allLessonRows.filter((l) => l.grade === picked);
  const lessonRows = visibleRows.filter((l) => l.kind === "LESSON");
  const tuteRows = visibleRows.filter((l) => l.kind === "TUTE");
  const byLesson = new Map<string, typeof files>();
  for (const f of files) {
    if (!f.lessonId) continue;
    byLesson.set(f.lessonId, [...(byLesson.get(f.lessonId) ?? []), f]);
  }

  return (
    <div className="space-y-8">
      {/* ආයුබෝවන් පුවරුව: navy පසුබිම, ශ්‍රේණිය/මාධ්‍යය, සහ කළ යුතු දේ */}
      <section className="pixel-grid relative overflow-hidden rounded-[1.75rem] bg-navy-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            <Avatar name={user.name} src={avatar} size="xl" tone="sun" />
            <div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{t("ආයුබෝවන්, {name}", { name: user.name })}</h1>
            <p className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-full bg-sun px-3 py-1 text-navy">{gradeLabel(user.grade, user.alYear, t)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">ICT</span>
              {medium && <span className="rounded-full bg-white/10 px-3 py-1">{t(MEDIUM_LABELS[medium])}</span>}
            </p>
            </div>
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

      <DashboardSearch user={user} params={searchParams} />

      {liveClasses.length > 0 && (
        <section className="space-y-3" data-testid="live-classes">
          {liveClasses.map((c) => {
            const hrs = Math.max(1, Math.ceil((c.expiresAt.getTime() - nowTs) / 3_600_000));
            return (
              <div key={c.id} data-class={c.id} className="card relative overflow-hidden border-accent/30 bg-gradient-to-r from-accent-soft via-white to-sun-soft p-4 sm:p-5">
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent to-orange-400" aria-hidden="true" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Tile icon="play" tone="red" size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-accent">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" aria-hidden="true" />
                        {t("Online පන්තිය")}
                      </span>
                      <span className="text-muted">{t("පැය {n}ක් පමණක් පෙනේ", { n: hrs })}</span>
                    </p>
                    <h2 className="mt-1.5 font-display text-lg font-bold text-navy [overflow-wrap:anywhere]">{c.title}</h2>
                    {c.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">{c.note}</p>}
                    <p className="mt-1.5 text-xs text-muted">{t("සැඟවෙන්නේ")}: {formatColombo(c.expiresAt)}</p>
                  </div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="zoom-join"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-white shadow-[0_12px_22px_-12px_rgb(230_0_8/0.8)] transition hover:brightness-110"
                  >
                    {t("Zoom එකට සම්බන්ධ වන්න")}
                  </a>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <NewsletterCard user={user} />

      {medium && (
        <Link
          href="/dashboard/agent"
          data-testid="agent-promo"
          className="card group relative flex items-center gap-4 overflow-hidden border-violet-200 bg-gradient-to-r from-violet-50 via-white to-primary-soft p-4 transition hover:-translate-y-0.5 hover:border-violet-400 sm:p-5"
        >
          <AgentLogo size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-navy">{t("Sage")}</p>
            <p className="text-sm leading-relaxed text-muted">{t("ICT ගැන ප්‍රශ්නයක්ද? ඔබේ Sage ගෙන් අහන්න — නොමිලේ credits ලැබී ඇත! 🎁")}</p>
          </div>
          <span className="hidden rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-primary-dark sm:inline-block">{t("කතා කරමු")}</span>
        </Link>
      )}

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
          <GradeTabs group={group} current={picked} own={user.grade} counts={gradeCounts} basePath="/dashboard" t={t} />
          <h2 className="text-xl font-bold">{t("පාඩම්")}</h2>
          {lessonRows.length === 0 ? (
            <EmptyState>{t("පාඩම් ඉක්මනින් එක් කෙරේ.")}</EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lessonRows.map((l) => {
                const items = byLesson.get(l.id) ?? [];
                const chips = LESSON_PAGE_ORDER.map((type) => ({ type, n: items.filter((i) => i.type === type).length })).filter((c) => c.n > 0);
                return (
                  <ToneCard key={l.id} tone={toneAt(l.order - 1)} href={`/dashboard/lessons/${l.id}`} data-lesson={l.id} className="flex flex-col p-5 pt-6">
                    <span
                      className={`pointer-events-none absolute -right-2 -top-5 select-none font-display text-8xl font-extrabold leading-none transition ${TONES[toneAt(l.order - 1)].mark}`}
                      aria-hidden="true"
                    >
                      {l.order}
                    </span>
                    <div className="relative flex items-center gap-3">
                      <Tile icon="book" tone={toneAt(l.order - 1)} />
                      <p className="text-xs font-bold text-navy/70">{shared ? `${gradeTag(l.grade)} · ` : ""}{t("පාඩම {n}", { n: l.order })}</p>
                    </div>
                    <h3 className="relative mt-3 min-h-[3rem] pr-8 font-semibold leading-snug text-navy">{l.title}</h3>

                    <div className="relative mt-4 flex flex-wrap gap-1.5">
                      {chips.length === 0 ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted">{t("ඉක්මනින්")}</span>
                      ) : (
                        chips.map((c) => (
                          <span key={c.type} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${RESOURCE_TONE[c.type].chip}`}>
                            <span aria-hidden="true">{RESOURCE_ICON[c.type]}</span>
                            {t(CONTENT_TYPE_LABELS[c.type])} · {c.n}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {t("පාඩම විවෘත කරන්න")}
                      <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </ToneCard>
                );
              })}
            </div>
          )}
        </section>
      )}

      {medium && tuteRows.length > 0 && (
        <section className="space-y-4" data-testid="tutes-section">
          <h2 className="text-xl font-bold">{t("Tutes")}</h2>
          <TuteCards tutes={tuteRows} files={files} t={t} gradeTags={shared ? Object.fromEntries(tuteRows.map((x) => [x.id, gradeTag(x.grade)])) : undefined} />
        </section>
      )}
    </div>
  );
}

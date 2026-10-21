import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Icon } from "@/components/icons";
import { EmptyState, HeroBadge, PageHero, listCard } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { quizAttempts, quizQuestions, quizzes } from "@/db/schema";
import { eligibleFor, finalizeExpired } from "@/lib/assessment";
import { getLang, getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";
import { formatColombo, nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz" };

export default async function StudentQuizzesPage() {
  const user = await requireStudent();
  const t = await getT();
  const lang = await getLang();
  await finalizeExpired({ studentId: user.id });

  const [list, mine] = await Promise.all([
    db
      .select({ q: quizzes, questions: sql<number>`(select count(*)::int from ${quizQuestions} where ${quizQuestions.quizId} = ${quizzes.id})` })
      .from(quizzes)
      .where(eligibleFor(user, quizzes))
      .orderBy(desc(quizzes.opensAt)),
    db.select().from(quizAttempts).where(eq(quizAttempts.studentId, user.id)),
  ]);
  const attemptOf = new Map(mine.map((a) => [a.quizId, a]));
  const now = nowMs();

  const rows = list.map(({ q, questions }) => {
    const a = attemptOf.get(q.id);
    const status: "done" | "running" | "open" | "upcoming" | "missed" = a?.submittedAt
      ? "done"
      : a
        ? "running"
        : now < q.opensAt.getTime()
          ? "upcoming"
          : now < q.closesAt.getTime()
            ? "open"
            : "missed";
    return { q, a, questions, status };
  });
  const order = { running: 0, open: 1, upcoming: 2, done: 3, missed: 4 } as const;
  rows.sort((x, y) => order[x.status] - order[y.status] || y.q.opensAt.getTime() - x.q.opensAt.getTime());

  const badge = {
    running: ["bg-amber-100 text-amber-800", t("සිදු වෙමින් පවතී")],
    open: ["bg-green-100 text-green-800", t("විවෘතයි")],
    upcoming: ["bg-slate-200 text-muted", t("ආරම්භ වී නැත")],
    done: ["bg-blue-100 text-blue-800", t("සම්පූර්ණයි")],
    missed: ["bg-red-100 text-red-800", t("වසා ඇත")],
  } as const;

  const tile = {
    running: "bg-sun-soft text-amber-700",
    open: "bg-emerald-50 text-emerald-700",
    upcoming: "bg-slate-100 text-muted",
    done: "bg-primary-soft text-primary",
    missed: "bg-accent-soft text-accent",
  } as const;
  const openCount = rows.filter((r) => r.status === "open" || r.status === "running").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="quiz"
        title="Quiz"
        subtitle={t("කාල සීමාවක් සහිත බහුවරණ Quiz. Start ඔබා එක් වරක් පමණක් උත්සාහ කළ හැක.")}
        badges={
          <HeroBadge tone="sun">{t("විවෘත Quiz")} · {openCount}</HeroBadge>
        }
      />
      {!user.medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {rows.length === 0 ? (
        <EmptyState icon="quiz">{t("දැනට Quiz නැත.")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ q, a, questions, status }) => (
            <li key={q.id}>
              <Link href={`/dashboard/quizzes/${q.id}`} className={`${listCard} group flex items-center gap-4`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile[status]}`}>
                  <Icon name={status === "done" ? "check" : "quiz"} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-navy">{q.title}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[status][0]}`}>{badge[status][1]}</span>
                    {a?.submittedAt && (
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                        {a.score}/{a.total}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {formatColombo(q.opensAt, lang)} → {formatColombo(q.closesAt, lang)} · {t("විනාඩි {n}", { n: q.durationMinutes })} · {t("ප්‍රශ්න {n}", { n: questions })}
                  </p>
                </div>
                <Icon name="arrow" className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

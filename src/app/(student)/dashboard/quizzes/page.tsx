import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">Quiz</h1>
      {!user.medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">{t("දැනට Quiz නැත.")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ q, a, questions, status }) => (
            <li key={q.id}>
              <Link href={`/dashboard/quizzes/${q.id}`} className="block space-y-1 card p-4 transition hover:border-primary">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{q.title}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge[status][0]}`}>{badge[status][1]}</span>
                  {a?.submittedAt && (
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                      {a.score}/{a.total}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {formatColombo(q.opensAt, lang)} → {formatColombo(q.closesAt, lang)} · {t("විනාඩි {n}", { n: q.durationMinutes })} · {t("ප්‍රශ්න {n}", { n: questions })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

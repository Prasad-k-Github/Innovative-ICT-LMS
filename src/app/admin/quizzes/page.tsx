import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes, quizAttempts, quizQuestions, quizzes } from "@/db/schema";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { targetLabel } from "@/lib/target";
import { formatColombo, nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizzesPage(props: PageProps<"/admin/quizzes">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const sp = await props.searchParams;
  const notice = sp.notice === "deleted" ? t("Quiz එක මකා දමන ලදී.") : "";

  const rows = await db
    .select({
      q: quizzes,
      institute: institutes.name,
      questions: sql<number>`(select count(*)::int from ${quizQuestions} where ${quizQuestions.quizId} = ${quizzes.id})`,
      attempts: sql<number>`(select count(*)::int from ${quizAttempts} where ${quizAttempts.quizId} = ${quizzes.id})`,
    })
    .from(quizzes)
    .leftJoin(institutes, eq(institutes.id, quizzes.instituteId))
    .orderBy(desc(quizzes.opensAt));
  const now = nowMs();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Quiz</h1>
        <Link href="/admin/quizzes/new" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
          + {t("අලුත් Quiz එකක්")}
        </Link>
      </div>
      <p className="text-sm text-muted">{t("බහුවරණ (MCQ) ප්‍රශ්න සහිත, කාල සීමාව ඇති Quiz. සිසුවා Start ඔබන විට කාලය ගණන් කරයි.")}</p>
      {notice && <Alert kind="success">{notice}</Alert>}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">{t("Quiz නැත.")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ q, institute, questions, attempts }) => {
            const state = now < q.opensAt.getTime() ? t("ආරම්භ වී නැත") : now < q.closesAt.getTime() ? t("විවෘතයි") : t("වසා ඇත");
            return (
              <li key={q.id}>
                <Link href={`/admin/quizzes/${q.id}`} className="block space-y-1 card p-4 transition hover:border-primary">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{q.title}</span>
                    {!q.isPublished ? (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-muted">{t("සඟවා ඇත")}</span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">{state}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted">{targetLabel({ grade: q.grade, medium: q.medium, instituteName: institute }, t)}</p>
                  <p className="text-xs text-muted">
                    {formatColombo(q.opensAt, lang)} → {formatColombo(q.closesAt, lang)} · {t("විනාඩි {n}", { n: q.durationMinutes })} · {t("ප්‍රශ්න {n}", { n: questions })} · {t("උත්සාහයන් {n}", { n: attempts })}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

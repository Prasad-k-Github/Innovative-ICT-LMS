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
import { EmptyState, PageHero, heroBtn } from "@/components/page-hero";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="quiz"
        title="Quiz"
        subtitle={t("බහුවරණ (MCQ) ප්‍රශ්න සහිත, කාල සීමාව ඇති Quiz. සිසුවා Start ඔබන විට කාලය ගණන් කරයි.")}
        actions={
          <Link href="/admin/quizzes/new" className={heroBtn}>
            + {t("අලුත් Quiz එකක්")}
          </Link>
        }
      />
      {notice && <Alert kind="success">{notice}</Alert>}

      {rows.length === 0 ? (
        <EmptyState>{t("Quiz නැත.")}</EmptyState>
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

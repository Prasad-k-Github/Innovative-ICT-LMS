import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Chip, Tile, ToneCard } from "@/components/cards";
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ q, institute, questions, attempts }) => {
            const upcoming = now < q.opensAt.getTime();
            const open = !upcoming && now < q.closesAt.getTime();
            const state = upcoming ? t("ආරම්භ වී නැත") : open ? t("විවෘතයි") : t("වසා ඇත");
            const tone = !q.isPublished ? "red" : upcoming ? "cyan" : open ? "green" : "sun";
            return (
              <li key={q.id}>
                <ToneCard tone={tone} href={`/admin/quizzes/${q.id}`} className="h-full space-y-3 p-4 pt-5">
                  <div className="flex items-start gap-3">
                    <Tile icon="quiz" tone={tone} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-navy">{q.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{targetLabel({ grade: q.grade, medium: q.medium, instituteName: institute }, t)}</p>
                    </div>
                    {!q.isPublished ? <Chip tone="red">{t("සඟවා ඇත")}</Chip> : <Chip tone={tone}>{state}</Chip>}
                  </div>
                  <p className="text-xs text-muted">
                    {formatColombo(q.opensAt, lang)} → {formatColombo(q.closesAt, lang)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone="blue">{t("විනාඩි {n}", { n: q.durationMinutes })}</Chip>
                    <Chip tone="violet">{t("ප්‍රශ්න {n}", { n: questions })}</Chip>
                    <Chip tone="green">{t("උත්සාහයන් {n}", { n: attempts })}</Chip>
                  </div>
                </ToneCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { startQuizAction } from "@/app/actions/student-work";
import { HeroBadge, PageHero } from "@/components/page-hero";
import { QuizRunner } from "@/components/student-work-forms";
import { Alert, btnPrimary } from "@/components/ui";
import { db } from "@/db";
import { quizAttempts, quizQuestions, quizzes } from "@/db/schema";
import { UUID_RE, eligibleFor, finalizeExpired } from "@/lib/assessment";
import { getLang, getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";
import { formatColombo, nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz" };

export default async function StudentQuizPage(props: PageProps<"/dashboard/quizzes/[id]">) {
  const user = await requireStudent();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await props.searchParams;

  await finalizeExpired({ studentId: user.id });
  const [q] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eligibleFor(user, quizzes)))
    .limit(1);
  if (!q) notFound();
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, id), eq(quizAttempts.studentId, user.id)))
    .limit(1);

  const now = nowMs();
  const backTo = { href: "/dashboard/quizzes", label: "Quiz" };

  /* ---- ක්‍රියාත්මකයි: Quiz එක කරමින් ---- */
  if (attempt && !attempt.submittedAt) {
    // correctIndex client එකට යවන්නේ නැත
    const questions = await db
      .select({ id: quizQuestions.id, text: quizQuestions.text, options: quizQuestions.options, marks: quizQuestions.marks })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, id))
      .orderBy(asc(quizQuestions.order));
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="font-display text-xl font-bold text-navy">{q.title}</h1>
        <QuizRunner
          quizId={q.id}
          attemptId={attempt.id}
          questions={questions}
          saved={attempt.answers ?? {}}
          secondsLeft={Math.max(0, Math.ceil((attempt.deadlineAt.getTime() - now) / 1000))}
        />
      </div>
    );
  }

  /* ---- සම්පූර්ණයි: ප්‍රතිඵලය ---- */
  if (attempt?.submittedAt) {
    const closed = now >= q.closesAt.getTime();
    const reveal = q.revealAnswers && closed;
    const questions = reveal
      ? await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, id)).orderBy(asc(quizQuestions.order))
      : [];
    const letters = "ABCDEF";
    return (
      <div className="w-full space-y-6">
        <PageHero icon="quiz" back={backTo} title={q.title} badges={<HeroBadge tone="sun">{t("ඔබගේ ලකුණු")}: {attempt.score}/{attempt.total}</HeroBadge>} />
        {sp.notice === "submitted" && <Alert kind="success">{t("ඔබගේ පිළිතුරු ඉදිරිපත් කරන ලදී.")}</Alert>}
        <section className="card p-6 text-center sm:p-8">
          <p className="text-sm text-muted">{t("ඔබගේ ලකුණු")}</p>
          <p className="mt-1 font-display text-5xl font-extrabold text-primary" data-testid="score">
            {attempt.score}/{attempt.total}
          </p>
        </section>
        {!reveal && (
          <Alert kind="info">
            {q.revealAnswers ? t("නිවැරදි පිළිතුරු Quiz එක වසා දැමූ පසු ({time}) දිස් වේ.", { time: formatColombo(q.closesAt, lang) }) : t("මෙම Quiz එකේ නිවැරදි පිළිතුරු පෙන්වන්නේ නැත.")}
          </Alert>
        )}
        {reveal && (
          <ol className="space-y-3">
            {questions.map((x, i) => {
              const mine = attempt.answers?.[x.id];
              const ok = mine === x.correctIndex;
              return (
                <li key={x.id} className={`space-y-2 rounded-2xl border p-4 ${ok ? "border-green-200 bg-green-50" : "border-red-200 bg-accent-soft"}`}>
                  <p className="font-medium">
                    {i + 1}. {x.text}
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {x.options.map((o, oi) => (
                      <li key={oi} className={oi === x.correctIndex ? "font-semibold text-green-800" : oi === mine ? "font-semibold text-red-700 line-through" : "text-muted"}>
                        {letters[oi]}. {o} {oi === x.correctIndex && "✓"} {oi === mine && oi !== x.correctIndex && `(${t("ඔබේ පිළිතුර")})`}
                      </li>
                    ))}
                  </ul>
                  {mine === undefined && <p className="text-xs text-muted">{t("පිළිතුරක් තෝරා නැත")}</p>}
                  {x.explanation && <p className="text-sm text-muted">{x.explanation}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  }

  /* ---- තවම ආරම්භ කර නැත ---- */
  const upcoming = now < q.opensAt.getTime();
  const closed = now >= q.closesAt.getTime();
  const [{ n }] = await db.select({ n: count() }).from(quizQuestions).where(eq(quizQuestions.quizId, id));
  const effective = Math.min(q.durationMinutes, Math.max(0, Math.floor((q.closesAt.getTime() - now) / 60000)));
  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="quiz"
        back={backTo}
        title={q.title}
        badges={
          <>
            <HeroBadge tone="sun">{t("කාලය: විනාඩි {n}", { n: q.durationMinutes })}</HeroBadge>
            <HeroBadge>{t("ප්‍රශ්න {n}", { n })}</HeroBadge>
          </>
        }
      />
      {sp.notice === "not-open" && <Alert kind="warning">{t("මෙම Quiz එක දැන් විවෘත නැත.")}</Alert>}
      <section className="space-y-3 card p-5 text-sm sm:p-6">
        {q.description && <p className="whitespace-pre-line leading-relaxed">{q.description}</p>}
        <ul className="space-y-1 text-muted">
          <li>{t("ප්‍රශ්න {n}", { n })}</li>
          <li>{t("කාලය: විනාඩි {n}", { n: q.durationMinutes })}</li>
          <li>
            {t("විවෘත වන්නේ")}: {formatColombo(q.opensAt, lang)}
          </li>
          <li>
            {t("වසන්නේ")}: {formatColombo(q.closesAt, lang)}
          </li>
        </ul>
        <Alert kind="info">{t("Start ඔබන මොහොතේ සිට කාලය ගණන් කරයි. කාලය අවසන් වූ විට පිළිතුරු ස්වයංක්‍රීයව ඉදිරිපත් වේ. එක් වරක් පමණක් උත්සාහ කළ හැක.")}</Alert>
      </section>
      {closed ? (
        <Alert kind="error">{t("මෙම Quiz එක වසා ඇත. ඔබ උත්සාහ කර නැත.")}</Alert>
      ) : upcoming ? (
        <Alert kind="warning">{t("Quiz එක {time} ට විවෘත වේ.", { time: formatColombo(q.opensAt, lang) })}</Alert>
      ) : (
        <form>
          {effective < q.durationMinutes && <p className="mb-2 text-sm text-amber-800">{t("Quiz එක වසන වේලාවට ආසන්න නිසා ඔබට ලැබෙන්නේ විනාඩි {n} ක් පමණි.", { n: Math.max(effective, 1) })}</p>}
          <button type="submit" formAction={startQuizAction.bind(null, q.id)} className={btnPrimary}>
            {t("Quiz එක ආරම්භ කරන්න")}
          </button>
        </form>
      )}
    </div>
  );
}

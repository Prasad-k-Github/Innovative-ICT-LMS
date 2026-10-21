import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import {
  addQuestionAction,
  deleteQuestionAction,
  deleteQuizAction,
  resetAttemptAction,
  toggleQuizAction,
  updateQuestionAction,
  updateQuizAction,
} from "@/app/actions/assessment";
import { QuestionForm, QuizForm } from "@/components/assessment-forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes, quizAttempts, quizQuestions, quizzes, users } from "@/db/schema";
import { UUID_RE, finalizeExpired } from "@/lib/assessment";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { targetLabel } from "@/lib/target";
import { formatColombo, toColomboInput } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Quiz" };
}

const NOTICES: Record<string, string> = {
  created: "Quiz එක සාදන ලදී. දැන් ප්‍රශ්න එක් කරන්න.",
  published: "Quiz එක සිසුන්ට පෙනෙන ලෙස සකසන ලදී.",
  hidden: "Quiz එක සිසුන්ගෙන් සඟවන ලදී.",
  "need-questions": "ප්‍රශ්න එකක්වත් නැති Quiz එකක් සිසුන්ට පෙන්විය නොහැක.",
  "q-deleted": "ප්‍රශ්නය මකා දමන ලදී.",
  locked: "සිසුන් උත්සාහ කර ඇති නිසා ප්‍රශ්න වෙනස් කළ නොහැක. පළමුව සිසුන්ගේ උත්සාහයන් ඉවත් කරන්න.",
  reset: "උත්සාහය ඉවත් කරන ලදී. සිසුවාට නැවත උත්සාහ කළ හැක.",
};

export default async function QuizDetailPage(props: PageProps<"/admin/quizzes/[id]">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await props.searchParams;

  await finalizeExpired({ quizId: id });

  const [q] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!q) notFound();
  const [inst, [instRow], questions, attempts] = await Promise.all([
    db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name)),
    db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, q.instituteId ?? "")).limit(1),
    db.select().from(quizQuestions).where(eq(quizQuestions.quizId, id)).orderBy(asc(quizQuestions.order)),
    db
      .select({ a: quizAttempts, name: users.name, school: users.school })
      .from(quizAttempts)
      .innerJoin(users, eq(users.id, quizAttempts.studentId))
      .where(eq(quizAttempts.quizId, id))
      .orderBy(asc(users.name)),
  ]);

  const totalMarks = questions.reduce((s, x) => s + x.marks, 0);
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : "";
  const locked = attempts.length > 0;
  const btn = "min-h-10 rounded-xl px-3 text-sm font-semibold transition";
  const card = "space-y-4 card p-5";
  const letters = "ABCDEF";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/quizzes" className="text-sm font-semibold text-primary hover:underline">
        ← Quiz
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{q.title}</h1>
        {!q.isPublished && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-muted">{t("සඟවා ඇත")}</span>}
      </div>
      <p className="text-sm text-muted">
        {targetLabel({ grade: q.grade, medium: q.medium, instituteName: instRow?.name }, t)}
        <br />
        {formatColombo(q.opensAt, lang)} → {formatColombo(q.closesAt, lang)} · {t("විනාඩි {n}", { n: q.durationMinutes })}
      </p>
      {notice && <Alert kind={sp.notice === "need-questions" || sp.notice === "locked" ? "warning" : "success"}>{notice}</Alert>}

      {/* ප්‍රතිඵල */}
      <section className={card}>
        <h2 className="font-semibold">
          {t("ප්‍රතිඵල")} <span className="text-sm font-normal text-muted">({attempts.length})</span>
        </h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted">{t("තවම කිසිවෙකු උත්සාහ කර නැත.")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {attempts.map(({ a, name, school }) => (
              <li key={a.id} data-attempt={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted">
                    {school} · {t("ආරම්භ කළේ")} {formatColombo(a.startedAt, lang)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.submittedAt ? (
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                      {a.score}/{a.total}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{t("සිදු වෙමින් පවතී")}</span>
                  )}
                  <form>
                    <ConfirmButton
                      message={t("{name} ගේ උත්සාහය ඉවත් කරන්නද? ඔහුට නැවත උත්සාහ කළ හැක.", { name })}
                      formAction={resetAttemptAction.bind(null, a.id)}
                      className={`${btn} border border-line bg-white hover:bg-slate-50`}
                    >
                      {t("නැවත සකසන්න")}
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ප්‍රශ්න */}
      <section className={card}>
        <h2 className="font-semibold">
          {t("ප්‍රශ්න")} <span className="text-sm font-normal text-muted">({questions.length} · {t("මුළු ලකුණු {n}", { n: totalMarks })})</span>
        </h2>
        {locked && <Alert kind="warning">{t("සිසුන් උත්සාහ කර ඇති නිසා ප්‍රශ්න වෙනස් කළ නොහැක. පළමුව සිසුන්ගේ උත්සාහයන් ඉවත් කරන්න.")}</Alert>}
        {questions.length === 0 ? (
          <p className="text-sm text-muted">{t("තවම ප්‍රශ්න නැත.")}</p>
        ) : (
          <ol className="space-y-3">
            {questions.map((x, i) => (
              <li key={x.id} data-question={x.id} className="space-y-2 rounded-xl border border-line p-3">
                <p className="text-sm font-medium">
                  {i + 1}. {x.text} <span className="text-xs font-normal text-muted">({t("ලකුණු {n}", { n: x.marks })})</span>
                </p>
                <ul className="space-y-0.5 text-sm">
                  {x.options.map((o, oi) => (
                    <li key={oi} className={oi === x.correctIndex ? "font-semibold text-green-700" : "text-muted"}>
                      {letters[oi]}. {o} {oi === x.correctIndex && "✓"}
                    </li>
                  ))}
                </ul>
                {!locked && (
                  <>
                    <form>
                      <ConfirmButton
                        message={t("මෙම ප්‍රශ්නය මකා දමන්නද?")}
                        formAction={deleteQuestionAction.bind(null, x.id)}
                        className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                      >
                        {t("මකන්න")}
                      </ConfirmButton>
                    </form>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-primary">{t("සංස්කරණය")}</summary>
                      <div className="mt-3">
                        <QuestionForm
                          action={updateQuestionAction}
                          id={x.id}
                          prefix={`e-${x.id}`}
                          submitLabel={t("සුරකින්න")}
                          initial={{ text: x.text, options: x.options, correct: x.correctIndex, marks: x.marks, explanation: x.explanation }}
                        />
                      </div>
                    </details>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {!locked && (
        <section className={card}>
          <h2 className="font-semibold">{t("අලුත් ප්‍රශ්නයක් එක් කරන්න")}</h2>
          <QuestionForm action={addQuestionAction} quizId={q.id} prefix="new" submitLabel={t("ප්‍රශ්නය එක් කරන්න")} />
        </section>
      )}

      <section className={card}>
        <h2 className="font-semibold">{t("Quiz විස්තර")}</h2>
        <QuizForm
          action={updateQuizAction}
          institutes={inst}
          id={q.id}
          submitLabel={t("සුරකින්න")}
          initial={{
            title: q.title,
            description: q.description,
            grade: String(q.grade),
            medium: q.medium,
            instituteId: q.instituteId ?? "",
            opensAt: toColomboInput(q.opensAt),
            closesAt: toColomboInput(q.closesAt),
            durationMinutes: String(q.durationMinutes),
            ...(q.revealAnswers ? { revealAnswers: "on" } : { revealAnswers: "off" }),
          }}
        />
        <form>
          <button type="submit" formAction={toggleQuizAction.bind(null, q.id)} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
            {q.isPublished ? t("Quiz එක සිසුන්ගෙන් සඟවන්න") : t("Quiz එක සිසුන්ට පෙන්වන්න")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold text-red-700">{t("අන්තරායකර කලාපය")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Quiz එක, ප්‍රශ්න සහ සියලු සිසුන්ගේ ප්‍රතිඵල සදහටම මකා දමයි.")}</p>
        <form className="mt-3">
          <ConfirmButton
            message={t("\"{name}\" සහ එහි සියලු ප්‍රතිඵල මකා දමන්නද?", { name: q.title })}
            formAction={deleteQuizAction.bind(null, q.id)}
            className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
          >
            {t("Quiz එක මකන්න")}
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}

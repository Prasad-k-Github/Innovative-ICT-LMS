import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { createQuizAction } from "@/app/actions/assessment";
import { QuizForm } from "@/components/assessment-forms";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { PageHero } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් Quiz එකක්") };
}

export default async function NewQuizPage() {
  await requireAdmin();
  const t = await getT();
  const inst = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));
  return (
    <div className="w-full space-y-6">
      <PageHero icon="quiz" back={{ href: "/admin/quizzes", label: "Quiz" }} title={t("අලුත් Quiz එකක්")} subtitle={t("Quiz එක සාදා, ඉන්පසු ප්‍රශ්න එක් කර, සිසුන්ට පෙන්වන්න.")} />
      <section className="card p-5 sm:p-6">
        <QuizForm action={createQuizAction} institutes={inst} submitLabel={t("Quiz එක සාදන්න")} initial={{ durationMinutes: "30", revealAnswers: "on" }} />
      </section>
    </div>
  );
}

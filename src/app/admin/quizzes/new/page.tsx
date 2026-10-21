import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { createQuizAction } from "@/app/actions/assessment";
import { QuizForm } from "@/components/assessment-forms";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

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
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin/quizzes" className="text-sm font-semibold text-primary hover:underline">
        ← Quiz
      </Link>
      <h1 className="text-3xl font-bold">{t("අලුත් Quiz එකක්")}</h1>
      <p className="text-sm text-muted">{t("Quiz එක සාදා, ඉන්පසු ප්‍රශ්න එක් කර, සිසුන්ට පෙන්වන්න.")}</p>
      <section className="card p-5">
        <QuizForm action={createQuizAction} institutes={inst} submitLabel={t("Quiz එක සාදන්න")} initial={{ durationMinutes: "30", revealAnswers: "on" }} />
      </section>
    </div>
  );
}

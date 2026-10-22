import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { submitTestimonialAction, withdrawTestimonialAction } from "@/app/actions/testimonials";
import { Chip, Tile, ToneCard } from "@/components/cards";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHero } from "@/components/page-hero";
import { StudentTestimonialForm } from "@/components/student-testimonial-form";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("මගේ අදහස") };
}

const NOTICES: Record<string, string> = {
  sent: "ස්තූතියි! ඔබේ අදහස ලැබුණා. ගුරුතුමා අනුමත කළ පසු Landing page එකේ පෙනේ.",
  withdrawn: "ඔබේ අදහස ඉවත් කරන ලදී.",
};

export default async function FeedbackPage(props: PageProps<"/dashboard/feedback">) {
  const me = await requireStudent();
  const t = await getT();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : undefined;
  const mine = await db.select().from(testimonials).where(eq(testimonials.submittedBy, me.id)).orderBy(desc(testimonials.createdAt)).limit(10);
  const parts = me.name.trim().split(/\s+/).filter(Boolean);
  const firstName = (parts[0] ?? "-").slice(0, 40);
  const initials = parts.map((p) => `${Array.from(p)[0]}.`).join(" ").slice(0, 40) || "-";
  const hasPending = mine.some((m) => m.status === "PENDING");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero icon="quote" title={t("මගේ අදහස")} subtitle={t("පන්තිය / මෙම පද්ධතිය ගැන ඔබේ අදහස එවන්න. අනුමත වූ පසු Landing page එකේ අනෙක් සිසුන්ට පෙනේ.")} />
      {notice && <Alert kind="success">{notice}</Alert>}

      <section className="card p-5 sm:p-6">
        {hasPending ? (
          <Alert kind="info">{t("ඔබගේ පෙර අදහස තවම අනුමැතිය බලාපොරොත්තුවෙන් සිටී. එය සමාලෝචනය කළ පසු නව එකක් එවන්න.")}</Alert>
        ) : (
          <StudentTestimonialForm action={submitTestimonialAction} firstName={firstName} initials={initials} gradeText={gradeLabel(me.grade, me.alYear, t)} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">{t("මා එවූ අදහස්")}</h2>
        {mine.length === 0 ? (
          <EmptyState icon="quote">{t("ඔබ තවම අදහසක් එවා නැත.")}</EmptyState>
        ) : (
          <ul className="grid gap-3" data-testid="my-feedback">
            {mine.map((m) => {
              const state = m.status === "APPROVED" && m.published ? "live" : m.status;
              return (
                <li key={m.id} data-status={state}>
                  <ToneCard tone={state === "live" ? "green" : m.status === "REJECTED" ? "red" : "sun"} className="p-4 pt-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <Tile icon="quote" tone={state === "live" ? "green" : m.status === "REJECTED" ? "red" : "sun"} />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{m.quote}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <Chip tone={state === "live" ? "green" : m.status === "REJECTED" ? "red" : "sun"}>
                            {state === "live" ? t("Landing page එකේ පෙනේ") : m.status === "REJECTED" ? t("පෙන්වීමට නොහැකි විය") : m.status === "PENDING" ? t("අනුමැතිය බලාපොරොත්තුවෙන්") : t("සැඟවී ඇත")}
                          </Chip>
                          <span>{t("පෙන්වන නම")}: {m.authorName}</span>
                        </p>
                      </div>
                      <form>
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton
                          message={t("මෙම අදහස ඉවත් කරන්නද?")}
                          formAction={withdrawTestimonialAction}
                          className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          {t("ඉවත් කරන්න")}
                        </ConfirmButton>
                      </form>
                    </div>
                  </ToneCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

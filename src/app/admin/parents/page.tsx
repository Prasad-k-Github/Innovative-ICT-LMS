import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { Avatar, StatCard } from "@/components/cards";
import { EmptyState, PageHero } from "@/components/page-hero";
import { SendSummariesButton } from "@/components/send-summaries-button";
import { inputClass } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { GRADES, MEDIUMS, MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { loadWeeklySummaries, summaryTextSi, whatsappLink } from "@/lib/parent-summary";
import { parseProgressFilters } from "@/lib/progress-filters";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("දෙමාපියන්") };
}

// දෙමාපියන්ට සතිපතා සාරාංශ: WhatsApp (ගුරුවරයා බොත්තම ඔබා යවයි) සහ Email (ස්වයංක්‍රීයව / දැන්ම)
export default async function AdminParentsPage(props: PageProps<"/admin/parents">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const f = parseProgressFilters(await props.searchParams);
  const conds = [eq(users.role, "STUDENT"), eq(users.status, "ACTIVE")];
  if (f.grade) conds.push(eq(users.grade, f.grade));
  if (f.medium) conds.push(eq(users.medium, f.medium));
  const [optedIn, notSet] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, grade: users.grade, alYear: users.alYear, medium: users.medium, parentEmail: users.parentEmail, parentPhone: users.parentPhone, sentAt: users.parentSummarySentAt })
      .from(users)
      .where(and(...conds, isNotNull(users.parentOptInAt), or(isNotNull(users.parentEmail), isNotNull(users.parentPhone))))
      .orderBy(asc(users.grade), asc(users.name)),
    db.select({ id: users.id }).from(users).where(and(...conds, or(isNull(users.parentOptInAt), and(isNull(users.parentEmail), isNull(users.parentPhone))))),
  ]);
  const summaries = await loadWeeklySummaries(optedIn.map((o) => o.id));
  const emailEligible = optedIn.filter((o) => o.parentEmail).length;
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" }) : t("තවම නැත"));

  return (
    <div className="w-full space-y-6">
      <PageHero icon="inbox" title={t("දෙමාපියන්")} subtitle={t("එකඟ වූ දෙමාපියන්ට සතිපතා ප්‍රගති සාරාංශය: Email ස්වයංක්‍රීයව (සතිපතා) හෝ දැන්ම, WhatsApp ඔබ බොත්තම ඔබා යවන්න.")} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="inbox" tone="green" value={optedIn.length} label={t("සාරාංශයට එකඟ දෙමාපියන්")} />
        <StatCard icon="users" tone="red" value={notSet.length} label={t("සම්බන්ධතා/එකඟත්වය නැති සිසුන්")} />
      </div>
      <form method="get" className="grid gap-3 card p-4 sm:grid-cols-3">
        <select name="grade" defaultValue={f.grade ? String(f.grade) : ""} aria-label={t("ශ්‍රේණිය")} className={inputClass}>
          <option value="">{t("සියලු ශ්‍රේණි")}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {gradeLabel(g, null, t)}
            </option>
          ))}
        </select>
        <select name="medium" defaultValue={f.medium ?? ""} aria-label={t("මාධ්‍යය")} className={inputClass}>
          <option value="">{t("සියලු මාධ්‍ය")}</option>
          {MEDIUMS.map((m) => (
            <option key={m} value={m}>
              {t(MEDIUM_LABELS[m])}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
          {t("පෙන්වන්න")}
        </button>
      </form>
      {emailEligible > 0 && (
        <section className="card space-y-2 p-5">
          <p className="text-sm text-muted">{t("Email සාරාංශ සෑම ඉරිදාවකම ස්වයංක්‍රීයව යැවේ (Vercel Cron). සිසුවෙකුට දින 6කට වරක් පමණි.")}</p>
          <SendSummariesButton eligible={emailEligible} />
        </section>
      )}
      {optedIn.length === 0 ? (
        <EmptyState icon="inbox">{t("සාරාංශයට එකඟ දෙමාපියන් නැත. සිසුවාගේ පිටුවෙන් (විස්තර සංස්කරණය) හෝ සිසුවා ඔහුගේ ගිණුමෙන් එකතු කළ හැක.")}</EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="parents-list">
          {optedIn.map((o) => {
            const sm = summaries.get(o.id);
            return (
              <li key={o.id} data-student={o.id} className="card space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={o.name} src={null} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/students/${o.id}?tab=progress`} className="block truncate font-semibold text-navy hover:text-primary">
                      {o.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {gradeLabel(o.grade, o.alYear, t)} · {o.medium ? t(MEDIUM_LABELS[o.medium]) : ""}
                    </p>
                  </div>
                  {sm?.inactive && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">{t("නිෂ්ක්‍රීය")}</span>}
                </div>
                <p className="text-xs text-muted">
                  {o.parentEmail && <span className="mr-3 break-all">✉ {o.parentEmail}</span>}
                  {o.parentPhone && <span>📱 {o.parentPhone}</span>}
                </p>
                <p className="text-xs text-muted">
                  {t("අවසන් Email සාරාංශය")}: {fmt(o.sentAt)}
                </p>
                {o.parentPhone && sm && (
                  <a
                    href={whatsappLink(o.parentPhone, summaryTextSi(sm))}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="whatsapp-link"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    {t("WhatsApp හරහා යවන්න")}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

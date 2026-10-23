import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { decideRequestAction } from "@/app/actions/admin";
import { Avatar, Chip, ToneCard } from "@/components/cards";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { changeRequests, institutes, users } from "@/db/schema";
import { avatarMap } from "@/lib/avatar";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { EmptyState, PageHero } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ඉල්ලීම්") };
}

const NOTICES: Record<string, string> = {
  approved: "ඉල්ලීම අනුමත කර සිසුවාගේ විස්තර යාවත්කාලීන කරන ලදී.",
  rejected: "ඉල්ලීම ප්‍රතික්ෂේප කරන ලදී.",
  gone: "මෙම ඉල්ලීම දැනටමත් සකසා ඇත හෝ ඉවත් කර ඇත.",
};

export default async function RequestsPage(props: PageProps<"/admin/requests">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : "";

  const rows = await db
    .select({
      id: changeRequests.id,
      status: changeRequests.status,
      grade: changeRequests.grade,
      alYear: changeRequests.alYear,
      medium: changeRequests.medium,
      note: changeRequests.note,
      createdAt: changeRequests.createdAt,
      newInstitute: institutes.name,
      studentId: users.id,
      name: users.name,
      curGrade: users.grade,
      curAlYear: users.alYear,
      curMedium: users.medium,
    })
    .from(changeRequests)
    .innerJoin(users, eq(users.id, changeRequests.userId))
    .leftJoin(institutes, eq(institutes.id, changeRequests.instituteId))
    .orderBy(desc(changeRequests.createdAt))
    .limit(60);

  const av = await avatarMap(rows.map((r) => r.studentId));
  const pending = rows.filter((r) => r.status === "PENDING");
  const done = rows.filter((r) => r.status !== "PENDING").slice(0, 15);
  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold";
  const date = (d: Date) => d.toLocaleDateString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" });

  return (
    <div className="w-full space-y-6">
      <PageHero icon="inbox" title={t("වෙනස් කිරීමේ ඉල්ලීම්")} subtitle={t("සිසුන් ඉල්ලූ ශ්‍රේණිය / මාධ්‍යය / ආයතන වෙනස්කම් අනුමත හෝ ප්‍රතික්ෂේප කරන්න.")} />
      {notice && <Alert kind="success">{notice}</Alert>}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-navy">{t("අනුමැතිය බලාපොරොත්තුවෙන්")}</h2>
        {pending.length === 0 ? (
          <EmptyState>{t("අනුමැතිය බලාපොරොත්තුවෙන් ඉල්ලීම් නැත.")}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id}>
                <ToneCard tone="sun" className="space-y-3 p-4 pt-5 text-sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} src={av.get(r.studentId)} />
                    <div>
                      <Link href={`/admin/students/${r.studentId}`} className="text-base font-semibold text-navy hover:text-primary hover:underline">
                        {r.name}
                      </Link>
                      <p className="text-xs text-muted">{date(r.createdAt)}</p>
                    </div>
                  </div>
                  <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-muted">{t("වත්මන්")}</p>
                      <p className="mt-1 font-medium">
                        {gradeLabel(r.curGrade, r.curAlYear, t)}
                        {r.curMedium ? ` · ${t(MEDIUM_LABELS[r.curMedium])}` : ""}
                      </p>
                    </div>
                    <span className="hidden items-center justify-center text-primary sm:flex" aria-hidden="true">
                      <Icon name="arrow" className="h-5 w-5" />
                    </span>
                    <div className="rounded-xl bg-primary-soft p-3">
                      <p className="text-xs font-semibold text-primary">{t("ඉල්ලන්නේ")}</p>
                      <p className="mt-1 font-semibold text-navy">
                        {gradeLabel(r.grade, r.alYear, t)} · {t(MEDIUM_LABELS[r.medium])} · {r.newInstitute ?? "—"}
                      </p>
                    </div>
                  </div>
                  {r.note && (
                    <p>
                      <span className="text-muted">{t("සටහන")}:</span> {r.note}
                    </p>
                  )}
                  <form className="flex gap-2">
                    <button type="submit" formAction={decideRequestAction.bind(null, "approve", r.id)} className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}>
                      {t("අනුමත කරන්න")}
                    </button>
                    <button type="submit" formAction={decideRequestAction.bind(null, "reject", r.id)} className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}>
                      {t("ප්‍රතික්ෂේප")}
                    </button>
                  </form>
                </ToneCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-navy">{t("මෑත තීරණ")}</h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.id} className="card flex items-center gap-3 p-3 text-sm">
                <Avatar name={r.name} size="sm" src={av.get(r.studentId)} tone={r.status === "APPROVED" ? "green" : "red"} />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-navy">{r.name}</span>
                  <span className="text-muted"> · {gradeLabel(r.grade, r.alYear, t)} · {t(MEDIUM_LABELS[r.medium])}</span>
                </span>
                <Chip tone={r.status === "APPROVED" ? "green" : "red"}>{r.status === "APPROVED" ? t("අනුමත කළා") : t("ප්‍රතික්ෂේප කළා")}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

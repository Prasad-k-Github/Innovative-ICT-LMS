import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { decideRequestAction } from "@/app/actions/admin";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { changeRequests, institutes, users } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

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

  const pending = rows.filter((r) => r.status === "PENDING");
  const done = rows.filter((r) => r.status !== "PENDING").slice(0, 15);
  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold";
  const date = (d: Date) => d.toLocaleDateString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">{t("වෙනස් කිරීමේ ඉල්ලීම්")}</h1>
      <p className="text-sm text-muted">{t("සිසුන් ඉල්ලූ ශ්‍රේණිය / මාධ්‍යය / ආයතන වෙනස්කම් අනුමත හෝ ප්‍රතික්ෂේප කරන්න.")}</p>
      {notice && <Alert kind="success">{notice}</Alert>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("අනුමැතිය බලාපොරොත්තුවෙන්")}</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            {t("අනුමැතිය බලාපොරොත්තුවෙන් ඉල්ලීම් නැත.")}
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="space-y-3 card p-4 text-sm">
                <div>
                  <Link href={`/admin/students/${r.studentId}`} className="text-base font-semibold hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted">{date(r.createdAt)}</p>
                </div>
                <p>
                  <span className="text-muted">{t("වත්මන්")}:</span> {gradeLabel(r.curGrade, r.curAlYear, t)}
                  {r.curMedium ? ` · ${t(MEDIUM_LABELS[r.curMedium])}` : ""}
                </p>
                <p>
                  <span className="text-muted">{t("ඉල්ලන්නේ")}:</span>{" "}
                  <strong>
                    {gradeLabel(r.grade, r.alYear, t)} · {t(MEDIUM_LABELS[r.medium])} · {r.newInstitute ?? "—"}
                  </strong>
                </p>
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("මෑත තීරණ")}</h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-white p-3 text-sm">
                <span className="font-medium">{r.name}</span> · {gradeLabel(r.grade, r.alYear, t)} · {t(MEDIUM_LABELS[r.medium])} ·{" "}
                <span className={r.status === "APPROVED" ? "text-green-700" : "text-red-700"}>
                  {r.status === "APPROVED" ? t("අනුමත කළා") : t("ප්‍රතික්ෂේප කළා")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

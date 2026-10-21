import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { cancelRequestAction } from "@/app/actions/student";
import { ChangePasswordForm, ChangeRequestForm, DeleteAccountForm, ProfileForm } from "@/components/profile-forms";
import { HeroBadge, PageHero, PageTabs, pickTab } from "@/components/page-hero";
import { SessionsCard } from "@/components/security-cards";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { changeRequests, institutes, users } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("මගේ ගිණුම") };
}

export default async function ProfilePage(props: PageProps<"/dashboard/profile">) {
  const me = await requireStudent();
  const t = await getT();
  const lang = await getLang();
  const sp = await props.searchParams;

  const [list, [full], [req]] = await Promise.all([
    db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name)),
    db
      .select({ createdAt: users.createdAt, institute: institutes.name })
      .from(users)
      .leftJoin(institutes, eq(institutes.id, users.instituteId))
      .where(eq(users.id, me.id))
      .limit(1),
    db
      .select({
        status: changeRequests.status,
        grade: changeRequests.grade,
        alYear: changeRequests.alYear,
        medium: changeRequests.medium,
        decidedAt: changeRequests.decidedAt,
        institute: institutes.name,
      })
      .from(changeRequests)
      .leftJoin(institutes, eq(institutes.id, changeRequests.instituteId))
      .where(eq(changeRequests.userId, me.id))
      .orderBy(desc(changeRequests.createdAt))
      .limit(1),
  ]);

  const tab = pickTab(sp.tab, ["details", "request", "password", "devices", "delete"]);
  const tabs = [
    { key: "details", label: t("මගේ විස්තර"), href: "/dashboard/profile" },
    { key: "request", label: t("වෙනස් කිරීමේ ඉල්ලීම"), href: "/dashboard/profile?tab=request" },
    { key: "password", label: t("මුරපදය"), href: "/dashboard/profile?tab=password" },
    { key: "devices", label: t("Devices"), href: "/dashboard/profile?tab=devices" },
    { key: "delete", label: t("ගිණුම මකන්න"), href: "/dashboard/profile?tab=delete", danger: true },
  ];
  const pending = req?.status === "PENDING";
  const card = "space-y-4 card p-5 sm:p-6";
  const info: [string, string][] = [
    ["Email ලිපිනය", me.email],
    ["ශ්‍රේණිය", gradeLabel(me.grade, me.alYear, t)],
    ["මාධ්‍යය", me.medium ? t(MEDIUM_LABELS[me.medium]) : "—"],
    ["පැමිණෙන ආයතනය", full?.institute ?? "—"],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="user"
        back={{ href: "/dashboard", label: t("Dashboard") }}
        title={t("මගේ ගිණුම")}
        badges={
          <>
            <HeroBadge tone="sun">{me.name}</HeroBadge>
            <HeroBadge>{gradeLabel(me.grade, me.alYear, t)}</HeroBadge>
            {me.medium && <HeroBadge>{t(MEDIUM_LABELS[me.medium])}</HeroBadge>}
          </>
        }
      />

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {sp.notice === "cancelled" && <Alert kind="success">{t("ඉල්ලීම අවලංගු කරන ලදී.")}</Alert>}

      {tab === "details" && (
      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("මගේ විස්තර")}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {info.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{t(k)}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <hr className="border-line" />
        <ProfileForm initial={{ name: me.name, school: me.school, phone: me.phone }} />
        <p className="text-xs text-muted">
          {t("Email ලිපිනය වෙනස් කිරීමට ආයතනය/Admin අමතන්න.")}
        </p>
      </section>
      )}

      {tab === "request" && (
      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("ශ්‍රේණිය / මාධ්‍යය / ආයතනය වෙනස් කිරීම")}</h2>
        <p className="text-sm text-muted">{t("මේවා වෙනස් කිරීමට Admin ගේ අනුමැතිය අවශ්‍යයි. ඉල්ලීමක් යවන්න.")}</p>

        {pending ? (
          <div className="space-y-3">
            <Alert kind="warning">
              {t("අනුමැතිය බලාපොරොත්තුවෙන් ඇති ඉල්ලීම:")}{" "}
              <strong>
                {gradeLabel(req.grade, req.alYear, t)} · {t(MEDIUM_LABELS[req.medium])} · {req.institute ?? "—"}
              </strong>
            </Alert>
            <form action={cancelRequestAction}>
              <button type="submit" className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50">
                {t("ඉල්ලීම අවලංගු කරන්න")}
              </button>
            </form>
          </div>
        ) : (
          <>
            {req && (
              <Alert kind={req.status === "APPROVED" ? "success" : "error"}>
                {req.status === "APPROVED" ? t("ඔබගේ අවසන් ඉල්ලීම අනුමත කරන ලදී.") : t("ඔබගේ අවසන් ඉල්ලීම ප්‍රතික්ෂේප කරන ලදී.")}
                {req.decidedAt ? ` (${req.decidedAt.toLocaleDateString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" })})` : ""}
              </Alert>
            )}
            <ChangeRequestForm
              institutes={list}
              current={{
                grade: String(me.grade),
                alYear: me.alYear ? String(me.alYear) : "",
                medium: me.medium ?? "",
                instituteId: me.instituteId ?? "",
              }}
            />
          </>
        )}
      </section>
      )}

      {tab === "password" && (
      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("මුරපදය වෙනස් කිරීම")}</h2>
        <ChangePasswordForm />
      </section>
      )}

      {tab === "devices" && <SessionsCard userId={me.id} t={t} lang={lang} />}

      {tab === "delete" && (
      <section className={`${card} !border-red-200`}>
        <h2 className="font-display text-lg font-bold text-red-700">{t("ගිණුම මකා දැමීම")}</h2>
        <p className="text-sm text-muted">
          {t("ගිණුම මකා දැමූ විට ඔබගේ සියලු විස්තර ඉවත් වේ. මෙය ආපසු හැරවිය නොහැක.")}
        </p>
        <DeleteAccountForm />
      </section>
      )}
    </div>
  );
}

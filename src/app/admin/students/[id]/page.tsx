import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { resendEmailAction, studentsAction, updateStudentAction } from "@/app/actions/admin";
import { ConfirmButton } from "@/components/confirm-button";
import { StudentForm } from "@/components/student-form";
import { Alert, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { auditLogs, changeRequests, institutes, users } from "@/db/schema";
import { ACTION_LABELS } from "@/lib/activity";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සිසුවා") };
}

const NOTICES: Record<string, [("success" | "warning" | "error"), string]> = {
  created: ["success", "සිසුවා එක් කරන ලදී. මුරපදය සකසා ගැනීමට Email ඇරයුමක් යවන ලදී."],
  "created-nomail": ["warning", "සිසුවා එක් කරන ලදී, නමුත් Email යැවීම අසාර්ථකයි. පහත 'ඇරයුම නැවත යවන්න' භාවිතා කරන්න."],
  "mail-sent": ["success", "Email යවන ලදී."],
  "mail-failed": ["error", "Email යැවීම අසාර්ථකයි. පසුව නැවත උත්සාහ කරන්න."],
  "mail-skipped": ["warning", "මෙම සිසුවාට එම Email යැවීම අදාළ නොවේ."],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage(props: PageProps<"/admin/students/[id]">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sp = await props.searchParams;

  const [s] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "STUDENT")))
    .limit(1);
  if (!s) notFound();

  const list = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));
  const actorUser = alias(users, "actor_user");
  const [history, reqs] = await Promise.all([
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actorName: actorUser.name, actorId: auditLogs.actorId })
      .from(auditLogs)
      .leftJoin(actorUser, eq(actorUser.id, auditLogs.actorId))
      .where(or(eq(auditLogs.targetId, id), eq(auditLogs.actorId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
    db
      .select({
        id: changeRequests.id,
        status: changeRequests.status,
        grade: changeRequests.grade,
        alYear: changeRequests.alYear,
        medium: changeRequests.medium,
        note: changeRequests.note,
        createdAt: changeRequests.createdAt,
        institute: institutes.name,
      })
      .from(changeRequests)
      .leftJoin(institutes, eq(institutes.id, changeRequests.instituteId))
      .where(eq(changeRequests.userId, id))
      .orderBy(desc(changeRequests.createdAt))
      .limit(10),
  ]);

  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;

  const here = `/admin/students/${s.id}`;
  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold transition";
  const fmt = (d: Date | null) => (d ? d.toLocaleString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" }) : "—");

  const tab = pickTab(sp.tab, ["overview", "edit", "requests", "history", "delete"]);
  const tabs = [
    { key: "overview", label: t("සාරාංශය"), href: tabHref(`/admin/students/${s.id}`, "overview", true) },
    { key: "edit", label: t("විස්තර සංස්කරණය"), href: tabHref(`/admin/students/${s.id}`, "edit", false) },
    { key: "requests", label: t("වෙනස් කිරීමේ ඉල්ලීම්"), href: tabHref(`/admin/students/${s.id}`, "requests", false), count: reqs.length },
    { key: "history", label: t("ක්‍රියා ඉතිහාසය"), href: tabHref(`/admin/students/${s.id}`, "history", false) },
    { key: "delete", label: t("මකන්න"), href: tabHref(`/admin/students/${s.id}`, "delete", false), danger: true },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero icon="user" back={{ href: "/admin/students", label: t("සිසුන්") }} title={s.name} badges={<StatusBadge status={s.status} t={t} />} />

      {notice && <Alert kind={notice[0]}>{t(notice[1])}</Alert>}

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "overview" && (
        <section className="card p-5 text-sm">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted">{t("ලියාපදිංචි වූ දිනය")}</dt>
            <dd>{fmt(s.createdAt)}</dd>
            <dt className="text-muted">{t("Email තහවුරු කිරීම")}</dt>
            <dd>{s.emailVerified ? `✓ ${t("තහවුරු කර ඇත")}` : t("තවම නැත")}</dd>
            <dt className="text-muted">{t("අවසන් Login")}</dt>
            <dd>{fmt(s.lastLoginAt)}</dd>
          </dl>
        </section>

      )}
      {tab === "overview" && (
        <section className="space-y-3 card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t("ගිණුම් ක්‍රියා")}</h2>
          <form className="flex flex-wrap gap-2">
            <input type="hidden" name="single" value={s.id} />
            <input type="hidden" name="returnTo" value={here} />
            {s.status === "PENDING" && (
              <button type="submit" formAction={studentsAction.bind(null, "approve")} className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}>
                {t("අනුමත කරන්න")}
              </button>
            )}
            {s.status === "ACTIVE" && (
              <button type="submit" formAction={studentsAction.bind(null, "suspend")} className={`${btn} bg-sun text-navy shadow-sm hover:brightness-95`}>
                {t("තාවකාලිකව අත්හිටුවන්න")}
              </button>
            )}
            {s.status === "SUSPENDED" && (
              <button type="submit" formAction={studentsAction.bind(null, "activate")} className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}>
                {t("නැවත සක්‍රිය කරන්න")}
              </button>
            )}
            {!s.emailVerified && (
              <button type="submit" formAction={resendEmailAction.bind(null, "verify")} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                {t("තහවුරු කිරීමේ Email නැවත යවන්න")}
              </button>
            )}
            {s.emailVerified && !s.lastLoginAt && (
              <button type="submit" formAction={resendEmailAction.bind(null, "invite")} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                {t("ඇරයුම නැවත යවන්න")}
              </button>
            )}
          </form>
          <p className="text-xs text-muted">
            {t("සිසුන්ගේ මුරපද Admin ට බැලීමට හෝ වෙනස් කිරීමට නොහැක. අමතක වූ විට සිසුවාම \"මුරපදය අමතකද?\" භාවිතා කරයි.")}
          </p>
        </section>

      )}
      {tab === "edit" && (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 font-semibold">{t("විස්තර සංස්කරණය")}</h2>
          <StudentForm
            action={updateStudentAction}
            institutes={list}
            id={s.id}
            submitLabel={t("සුරකින්න")}
            initial={{
              name: s.name,
              school: s.school,
              grade: String(s.grade),
              alYear: s.alYear ? String(s.alYear) : "",
              medium: s.medium ?? "",
              phone: s.phone,
              email: s.email,
              instituteId: s.instituteId ?? "",
            }}
          />
        </section>

      )}
      {tab === "requests" && (
        <section className="space-y-3 card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t("වෙනස් කිරීමේ ඉල්ලීම්")}</h2>
          {reqs.length === 0 ? (
            <p className="text-sm text-muted">{t("ඉල්ලීම් නැත.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reqs.map((r) => (
                <li key={r.id} className="border-b border-line pb-2 last:border-0 last:pb-0">
                  <p>
                    <strong>
                      {gradeLabel(r.grade, r.alYear, t)} · {t(MEDIUM_LABELS[r.medium])} · {r.institute ?? "—"}
                    </strong>{" "}
                    <span className={r.status === "APPROVED" ? "text-green-700" : r.status === "REJECTED" ? "text-red-700" : "text-amber-700"}>
                      {r.status === "APPROVED" ? t("අනුමත කළා") : r.status === "REJECTED" ? t("ප්‍රතික්ෂේප කළා") : t("අනුමැතිය බලාපොරොත්තුවෙන්")}
                    </span>
                  </p>
                  {r.note && <p className="text-muted">{r.note}</p>}
                  <p className="text-xs text-muted">{fmt(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {reqs.some((r) => r.status === "PENDING") && (
            <Link href="/admin/requests" className="text-sm font-semibold text-primary hover:underline">
              {t("ඉල්ලීම් පිටුවට යන්න →")}
            </Link>
          )}
        </section>

      )}
      {tab === "history" && (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-3 font-semibold">{t("ක්‍රියා ඉතිහාසය")}</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">{t("ක්‍රියා නැත.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span>
                    {t(ACTION_LABELS[h.action] ?? h.action)}
                    {h.actorId && h.actorId !== id && <span className="text-muted"> · {h.actorName ?? t("(ඉවත් කළ පරිශීලකයෙක්)")}</span>}
                  </span>
                  <span className="text-xs text-muted">{fmt(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

      )}
      {tab === "delete" && (
        <section className="rounded-2xl border border-red-200 bg-white p-5">
          <h2 className="font-semibold text-red-700">{t("අන්තරායකර කලාපය")}</h2>
          <p className="mt-1 text-sm text-muted">{t("සිසුවා සදහටම මකා දමයි. මෙය ආපසු හැරවිය නොහැක.")}</p>
          <form className="mt-3">
            <input type="hidden" name="single" value={s.id} />
            <input type="hidden" name="returnTo" value="/admin/students" />
            <ConfirmButton
              message={t("{name} සදහටම මකා දමන්නද?", { name: s.name })}
              formAction={studentsAction.bind(null, "delete")}
              className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
            >
              {t("සිසුවා මකන්න")}
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}

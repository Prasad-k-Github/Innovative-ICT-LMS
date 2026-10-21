import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { adminOpAction, resendAdminInviteAction, resetAdminMfaAction, updateAdminAction } from "@/app/actions/super-admin";
import { AdminUserForm } from "@/components/admin-user-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { ACTION_LABELS } from "@/lib/activity";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireSuperAdmin } from "@/lib/session";
import { PageHero } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Admin") };
}

const NOTICES: Record<string, ["success" | "warning" | "error", string]> = {
  created: ["success", "Admin එක් කරන ලදී. මුරපදය සකසා ගැනීමට Email ඇරයුමක් යවන ලදී."],
  "created-nomail": ["warning", "Admin එක් කරන ලදී, නමුත් Email යැවීම අසාර්ථකයි. පහත 'ඇරයුම නැවත යවන්න' භාවිතා කරන්න."],
  suspended: ["success", "Admin අත්හිටුවන ලදී."],
  activated: ["success", "Admin නැවත සක්‍රිය කරන ලදී."],
  "mail-sent": ["success", "Email යවන ලදී."],
  "mail-failed": ["error", "Email යැවීම අසාර්ථකයි. පසුව නැවත උත්සාහ කරන්න."],
  "mfa-reset": ["success", "2-step verification නැති කර, සියලු sessions අවසන් කරන ලදී."],
  "mail-skipped": ["warning", "මෙම Admin දැනටමත් login වී ඇති නිසා ඇරයුම අදාළ නොවේ."],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminDetailPage(props: PageProps<"/admin/admins/[id]">) {
  await requireSuperAdmin();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sp = await props.searchParams;

  const [a] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, "ADMIN"))).limit(1);
  if (!a) notFound();

  const history = await db
    .select({ id: auditLogs.id, action: auditLogs.action, target: auditLogs.target, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.actorId, id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold transition";
  const fmt = (d: Date | null) => (d ? d.toLocaleString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" }) : "—");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero icon="shield" back={{ href: "/admin/admins", label: t("Admin ලා") }} title={a.name} badges={<StatusBadge status={a.status} t={t} />} />
      {notice && <Alert kind={notice[0]}>{t(notice[1])}</Alert>}

      <section className="space-y-3 card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">{t("ගිණුම් ක්‍රියා")}</h2>
        <p className="text-sm text-muted">
          {t("අවසන් Login")}: {fmt(a.lastLoginAt)} · {t("2-step verification")}: {a.mfaEnabledAt ? t("සක්‍රියයි") : t("අක්‍රියයි")}
        </p>
        <div className="flex flex-wrap gap-2">
          {a.status === "ACTIVE" && (
            <form action={adminOpAction.bind(null, "suspend", a.id)}>
              <button type="submit" className={`${btn} bg-sun text-navy shadow-sm hover:brightness-95`}>
                {t("තාවකාලිකව අත්හිටුවන්න")}
              </button>
            </form>
          )}
          {a.status === "SUSPENDED" && (
            <form action={adminOpAction.bind(null, "activate", a.id)}>
              <button type="submit" className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}>
                {t("නැවත සක්‍රිය කරන්න")}
              </button>
            </form>
          )}
          {a.mfaEnabledAt && (
            <form action={resetAdminMfaAction.bind(null, a.id)}>
              <button type="submit" data-testid="reset-mfa" className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                {t("2-step verification නැවත සකසන්න (reset)")}
              </button>
            </form>
          )}
          {!a.lastLoginAt && (
            <form action={resendAdminInviteAction.bind(null, a.id)}>
              <button type="submit" className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                {t("ඇරයුම නැවත යවන්න")}
              </button>
            </form>
          )}
        </div>
        <p className="text-xs text-muted">{t("Admin ගේ මුරපදය ඔබට බැලීමට හෝ වෙනස් කිරීමට නොහැක. ඔවුන් \"මුරපදය අමතකද?\" භාවිතා කරයි.")}</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">{t("විස්තර සංස්කරණය")}</h2>
        <AdminUserForm action={updateAdminAction} id={a.id} initial={{ name: a.name, email: a.email }} submitLabel={t("සුරකින්න")} />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 font-semibold">{t("මෑත ක්‍රියා")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">{t("තවම ක්‍රියා නැත.")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0 last:pb-0">
                <span>
                  {t(ACTION_LABELS[h.action] ?? h.action)}
                  {h.target ? <span className="text-muted"> · {h.target}</span> : null}
                </span>
                <span className="text-xs text-muted">{fmt(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold text-red-700">{t("අන්තරායකර කලාපය")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Admin ගිණුම සදහටම මකා දමයි. මෙය ආපසු හැරවිය නොහැක.")}</p>
        <form className="mt-3">
          <ConfirmButton
            message={t("{name} සදහටම මකා දමන්නද?", { name: a.name })}
            formAction={adminOpAction.bind(null, "delete", a.id)}
            className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
          >
            {t("Admin මකන්න")}
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}

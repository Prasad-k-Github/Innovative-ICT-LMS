import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, like, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { ACTION_GROUPS, ACTION_LABELS } from "@/lib/activity";
import { verifyAuditChain } from "@/lib/audit";
import { describeDevice } from "@/lib/request-context";
import { Avatar, ToneCard, toneOfText } from "@/components/cards";
import { Alert, inputClass } from "@/components/ui";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireSuperAdmin } from "@/lib/session";
import { EmptyState, PageHero } from "@/components/page-hero";

export const dynamic = "force-dynamic";
const PAGE = 30;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ක්‍රියා ඉතිහාසය") };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  await requireSuperAdmin();
  const t = await getT();
  const lang = await getLang();
  const sp = await props.searchParams;
  const group = ACTION_GROUPS.some((g) => g.value === one(sp.group)) ? one(sp.group) : "";
  const actor = /^[0-9a-f-]{36}$/i.test(one(sp.actor)) ? one(sp.actor) : "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const conds: (SQL | undefined)[] = [];
  if (group) conds.push(like(auditLogs.action, `${group}.%`));
  if (actor) conds.push(eq(auditLogs.actorId, actor));
  const where = conds.length ? and(...conds) : undefined;

  const actorUser = alias(users, "actor_user");
  const [[{ total }], rows, staff] = await Promise.all([
    db.select({ total: count() }).from(auditLogs).where(where),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        target: auditLogs.target,
        ip: auditLogs.ip,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        actorName: actorUser.name,
        actorRole: actorUser.role,
      })
      .from(auditLogs)
      .leftJoin(actorUser, eq(actorUser.id, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(
      // Admin ලා සහ Super Admin පමණි (filter සඳහා)
      eq(users.role, "ADMIN"),
    ),
  ]);
  const [superAdmin] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "SUPER_ADMIN")).limit(1);
  const actors = [...(superAdmin ? [{ id: superAdmin.id, name: superAdmin.name }] : []), ...staff.map((s) => ({ id: s.id, name: s.name }))];

  // ?verify=1: සම්පූර්ණ audit chain එක නැවත ගණනය කර tamper-evidence තහවුරු කරයි
  const report = one(sp.verify) === "1" ? await verifyAuditChain() : null;

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const q = new URLSearchParams();
    if (group) q.set("group", group);
    if (actor) q.set("actor", actor);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/admin/activity${s ? `?${s}` : ""}`;
  };
  const link = "inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-4 text-sm";

  return (
    <div className="w-full space-y-6">
      <PageHero icon="activity" title={t("ක්‍රියා ඉතිහාසය")} subtitle={t("Admin ලා සහ සිසුන් කළ ක්‍රියා (නවතම පළමුව).")} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/activity?verify=1" data-testid="verify-chain" className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-primary-soft">
          {t("Log integrity පරීක්ෂා කරන්න")}
        </Link>
        <span className="text-xs text-muted">{t("සෑම ඇතුළත් කිරීමක්ම පෙර එකට cryptographic ලෙස බැඳේ; වෙනස් කිරීම් හෝ මකා දැමීම් හඳුනාගත හැක.")}</span>
      </div>
      {report &&
        (report.ok ? (
          <Alert kind="success">
            <span data-testid="chain-result" data-ok="1">{t("Log integrity තහවුරුයි: ඇතුළත් කිරීම් {n}ක් පරීක්ෂා කළා, chain එක නොබිඳී ඇත.", { n: report.checked })}</span>
          </Alert>
        ) : (
          <Alert kind="error">
            <span data-testid="chain-result" data-ok="0">{t("අවවාදයයි: log එක වෙනස් කර ඇති බවට සැකයි (අනුක්‍රම අංකය {seq}).", { seq: report.brokenSeq ?? 0 })}</span>
          </Alert>
        ))}

      <form method="get" className="grid gap-3 card p-4 sm:grid-cols-3">
        <select name="group" defaultValue={group} aria-label={t("වර්ගය")} className={inputClass}>
          <option value="">{t("සියලු වර්ග")}</option>
          {ACTION_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {t(g.label)}
            </option>
          ))}
        </select>
        <select name="actor" defaultValue={actor} aria-label={t("කළේ")} className={inputClass}>
          <option value="">{t("සියලු Admin ලා")}</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
          {t("සොයන්න")}
        </button>
      </form>

      <p className="text-sm text-muted">{t("ක්‍රියා {n}ක්", { n: total })}</p>

      {rows.length === 0 ? (
        <EmptyState>{t("ක්‍රියා නැත.")}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <ToneCard tone={toneOfText(r.action.split(/[._]/)[0])} className="flex items-start gap-3 p-3 pt-4 text-sm">
                <Avatar name={r.actorName ?? "?"} size="sm" tone={toneOfText(r.action.split(/[._]/)[0])} />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-semibold text-navy">{r.actorName ?? t("(ඉවත් කළ පරිශීලකයෙක්)")}</span>
                    {r.actorRole === "SUPER_ADMIN" && <span className="ml-1 rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">Super</span>}{" "}
                    — {t(ACTION_LABELS[r.action] ?? r.action)}
                    {r.target ? <span className="break-all text-muted"> · {r.target}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.createdAt.toLocaleString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" })}
                    {r.ip ? ` · ${r.ip}` : ""}
                    {r.userAgent ? ` · ${describeDevice(r.userAgent)}` : ""}
                  </p>
                </div>
              </ToneCard>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t("පිටු")}>
          {page > 1 ? <Link href={qs(page - 1)} className={link}>{t("← කලින්")}</Link> : <span />}
          <span className="text-muted">{t("පිටුව {page} / {pages}", { page, pages })}</span>
          {page < pages ? <Link href={qs(page + 1)} className={link}>{t("ඊළඟ →")}</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

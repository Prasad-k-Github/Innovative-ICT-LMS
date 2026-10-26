import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { grantAgentCreditsAction, grantAllAgentCreditsAction } from "@/app/actions/agent";
import { Avatar, Chip, StatCard } from "@/components/cards";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Alert, inputClass } from "@/components/ui";
import { db } from "@/db";
import { agentAttachments, agentMessages, agentWallets, users } from "@/db/schema";
import { AGENT_MAX_GRANT, AGENT_NAME } from "@/lib/agent-config";
import { freeCredits } from "@/lib/agent";
import { agentLimits, agentUsage } from "@/lib/agent-usage";
import { avatarMap } from "@/lib/avatar";
import { UUID_RE } from "@/lib/assessment";
import { gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { formatColombo } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t(AGENT_NAME) };
}

const NOTICES: Record<string, string> = { granted: "Credits එක් කරන ලදී.", granted_all: "සියලුම ක්‍රියාකාරී සිසුන්ට credits එක් කරන ලදී." };

export default async function AdminAgentPage(props: PageProps<"/admin/agent">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const viewId = typeof sp.student === "string" && UUID_RE.test(sp.student) ? sp.student : null;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : undefined;
  const error = typeof sp.error === "string" ? t(sp.error.slice(0, 200)) : undefined;
  const free = freeCredits();

  const where = and(
    eq(users.role, "STUDENT"),
    q ? or(ilike(users.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(users.email, `%${q.replace(/[%_\\]/g, "\\$&")}%`)) : undefined,
  );
  const usage = await agentUsage();
  const lim = agentLimits();
  const [rows, [tot], [msgs]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        grade: users.grade,
        alYear: users.alYear,
        balance: agentWallets.balance,
        used: agentWallets.used,
      })
      .from(users)
      .leftJoin(agentWallets, eq(agentWallets.userId, users.id))
      .where(where)
      .orderBy(desc(sql`coalesce(${agentWallets.used}, 0)`), users.name)
      .limit(100),
    db.select({ used: sql<number>`coalesce(sum(${agentWallets.used}), 0)::int`, users: count() }).from(agentWallets).innerJoin(users, eq(users.id, agentWallets.userId)).where(eq(users.role, "STUDENT")),
    db.select({ n: count() }).from(agentMessages).innerJoin(users, eq(users.id, agentMessages.userId)).where(and(eq(agentMessages.role, "user"), eq(users.role, "STUDENT"))),
  ]);

  const av = await avatarMap([...rows.map((r) => r.id), ...(viewId ? [viewId] : [])]);
  const viewer = viewId ? (await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, viewId), eq(users.role, "STUDENT"))).limit(1))[0] : undefined;
  const convoRows = viewer
    ? (await db.select({ id: agentMessages.id, role: agentMessages.role, content: agentMessages.content, at: agentMessages.createdAt }).from(agentMessages).where(eq(agentMessages.userId, viewer.id)).orderBy(desc(agentMessages.createdAt)).limit(60)).reverse()
    : [];
  const attach = convoRows.length
    ? await db.select({ id: agentAttachments.id, messageId: agentAttachments.messageId, name: agentAttachments.filename, mime: agentAttachments.mime }).from(agentAttachments).where(inArray(agentAttachments.messageId, convoRows.map((m) => m.id)))
    : [];
  const convo = convoRows.map((m) => ({ ...m, files: attach.filter((f) => f.messageId === m.id) }));

  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold";
  return (
    <div className="w-full space-y-6">
      <PageHero icon="chat" title={t(AGENT_NAME)} subtitle={t("සිසුන්ගේ ICT Agent credits කළමනාකරණය සහ සංවාද නිරීක්ෂණය. සෑම සිසුවෙකුටම මුලින් නොමිලේ credits {n}ක් ලැබේ.", { n: free })} />
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {usage.level !== "ok" && (
        <div data-testid="budget-alert" data-level={usage.level}>
          <Alert kind={usage.level === "over" ? "error" : "warning"}>
            {usage.level === "over"
              ? t("මාසික අයවැය ඉක්මවා ඇත: ආසන්න පිරිවැය ${cost} / ${budget}.", { cost: usage.cost.toFixed(2), budget: usage.budget.toFixed(2) })
              : t("මාසික අයවැයෙන් 80% ක් පමණ භාවිතා වී ඇත: ආසන්න පිරිවැය ${cost} / ${budget}.", { cost: usage.cost.toFixed(2), budget: usage.budget.toFixed(2) })}
          </Alert>
        </div>
      )}
      <section className="card space-y-3 p-4 sm:p-5" data-testid="usage-card">
        <h2 className="font-semibold text-navy">{t("භාවිතය සහ පිරිවැය")}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">{t("අද පණිවිඩ")}</dt><dd className="font-semibold" data-testid="usage-today">{usage.today}</dd></div>
          <div><dt className="text-muted">{t("මෙම මාසයේ පණිවිඩ")}</dt><dd className="font-semibold" data-testid="usage-month">{usage.month}</dd></div>
          <div><dt className="text-muted">{t("ආසන්න පිරිවැය (USD)")}</dt><dd className="font-semibold" data-testid="usage-cost">${usage.cost.toFixed(2)}</dd></div>
          <div><dt className="text-muted">{t("මාසික අයවැය (USD)")}</dt><dd className="font-semibold">{usage.budget > 0 ? `$${usage.budget.toFixed(2)}` : t("නියම කර නැත")}</dd></div>
        </dl>
        {usage.pct !== null && (
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.min(100, Math.round(usage.pct * 100))} aria-valuemin={0} aria-valuemax={100} aria-label={t("අයවැය භාවිතය")}>
            <div className={`h-full rounded-full ${usage.level === "over" ? "bg-accent" : usage.level === "warn" ? "bg-sun" : "bg-primary"}`} style={{ width: `${Math.min(100, Math.round(usage.pct * 100))}%` }} />
          </div>
        )}
        <p className="text-xs text-muted">
          {t("සීමා: සිසුවෙකුට දිනකට පණිවිඩ {daily}, සමස්තයක් දිනකට {global}. (0 = සීමාවක් නැත.) අයවැය සහ සීමා environment variables වලින් සකසයි.", { daily: lim.daily, global: lim.globalDaily })}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="users" tone="blue" value={tot?.users ?? 0} label={t("Agent භාවිතා කරන සිසුන්")} />
        <StatCard icon="chat" tone="violet" value={msgs?.n ?? 0} label={t("ඇසූ ප්‍රශ්න")} />
        <StatCard icon="sparkle" tone="sun" value={tot?.used ?? 0} label={t("භාවිතා කළ credits")} />
      </div>

      <form action={grantAllAgentCreditsAction} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="all-amount" className="text-sm font-semibold text-navy">{t("සියලුම ක්‍රියාකාරී සිසුන්ට credits එක් කරන්න")}</label>
          <input id="all-amount" name="amount" type="number" min={1} max={AGENT_MAX_GRANT} defaultValue={10} required className={`${inputClass} mt-1.5`} />
        </div>
        <button type="submit" className={`${btn} bg-primary text-white hover:bg-primary-dark`}>{t("සියල්ලන්ට එක් කරන්න")}</button>
      </form>

      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder={t("නමෙන් හෝ email එකෙන් සොයන්න")} aria-label={t("සිසුන් සොයන්න")} className={inputClass} />
        <button type="submit" className={`${btn} border border-line bg-white hover:bg-slate-50`}>{t("සොයන්න")}</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon="users">{t("සිසුන් හමු නොවීය.")}</EmptyState>
      ) : (
        <ul className="grid gap-3" data-testid="agent-students">
          {rows.map((r) => (
            <li key={r.id} className="card p-4" data-student={r.id}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={r.name} src={av.get(r.id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy">{r.name}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    <Chip tone="blue">{gradeLabel(r.grade, r.alYear, t)}</Chip>
                    <Chip tone="sun" icon="sparkle">{t("ඉතිරි {n}", { n: r.balance ?? free })}</Chip>
                    <Chip tone="violet">{t("භාවිතා {n}", { n: r.used ?? 0 })}</Chip>
                  </p>
                </div>
                <form action={grantAgentCreditsAction} className="flex items-center gap-2">
                  <input type="hidden" name="studentId" value={r.id} />
                  <input name="amount" type="number" min={1} max={AGENT_MAX_GRANT} defaultValue={10} required aria-label={t("එක් කරන credits ගණන")} className={`${inputClass} !w-24`} />
                  <button type="submit" className={`${btn} border border-line bg-white hover:bg-slate-50`}>{t("එක් කරන්න")}</button>
                </form>
                <Link href={`/admin/agent?student=${r.id}${q ? `&q=${encodeURIComponent(q)}` : ""}#chat`} className={`${btn} inline-flex items-center border border-line bg-white hover:bg-slate-50`}>
                  {t("සංවාද බලන්න")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewer && (
        <section id="chat" className="card space-y-3 p-5" data-testid="agent-convo">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-navy">
            <Avatar name={viewer.name} size="sm" src={av.get(viewer.id)} />
            {t("{name} ගේ සංවාද", { name: viewer.name })}
          </h2>
          {convo.length === 0 ? (
            <p className="text-sm text-muted">{t("තවම සංවාද නැත.")}</p>
          ) : (
            <ul className="space-y-2">
              {convo.map((m) => (
                <li key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary-soft text-navy" : "bg-slate-50 text-ink"}`}>
                  <p className="mb-0.5 text-xs font-semibold text-muted">
                    {m.role === "user" ? viewer.name : t(AGENT_NAME)} · {formatColombo(m.at)}
                  </p>
                  {m.files.length > 0 && (
                    <p className="mb-1 flex flex-wrap gap-2" data-testid="admin-attachments">
                      {m.files.map((f) => (
                        <a key={f.id} href={`/api/agent-file/${f.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-primary ring-1 ring-line hover:bg-primary-soft">
                          📎 {f.name}
                        </a>
                      ))}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { grantAgentCreditsAction, grantAllAgentCreditsAction } from "@/app/actions/agent";
import { Chip, StatCard } from "@/components/cards";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Alert, inputClass } from "@/components/ui";
import { db } from "@/db";
import { agentMessages, agentWallets, users } from "@/db/schema";
import { AGENT_MAX_GRANT, AGENT_NAME } from "@/lib/agent-config";
import { freeCredits } from "@/lib/agent";
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
    db.select({ used: sql<number>`coalesce(sum(${agentWallets.used}), 0)::int`, users: count() }).from(agentWallets),
    db.select({ n: count() }).from(agentMessages).where(eq(agentMessages.role, "user")),
  ]);

  const viewer = viewId ? (await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, viewId), eq(users.role, "STUDENT"))).limit(1))[0] : undefined;
  const convo = viewer
    ? (await db.select({ id: agentMessages.id, role: agentMessages.role, content: agentMessages.content, at: agentMessages.createdAt }).from(agentMessages).where(eq(agentMessages.userId, viewer.id)).orderBy(desc(agentMessages.createdAt)).limit(60)).reverse()
    : [];

  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero icon="chat" title={t(AGENT_NAME)} subtitle={t("සිසුන්ගේ ICT Agent credits කළමනාකරණය සහ සංවාද නිරීක්ෂණය. සෑම සිසුවෙකුටම මුලින් නොමිලේ credits {n}ක් ලැබේ.", { n: free })} />
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

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
          <h2 className="font-display text-lg font-bold text-navy">{t("{name} ගේ සංවාද", { name: viewer.name })}</h2>
          {convo.length === 0 ? (
            <p className="text-sm text-muted">{t("තවම සංවාද නැත.")}</p>
          ) : (
            <ul className="space-y-2">
              {convo.map((m) => (
                <li key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary-soft text-navy" : "bg-slate-50 text-ink"}`}>
                  <p className="mb-0.5 text-xs font-semibold text-muted">
                    {m.role === "user" ? viewer.name : t(AGENT_NAME)} · {formatColombo(m.at)}
                  </p>
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

import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Chip, Tile, ToneCard } from "@/components/cards";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { assignments, institutes, submissions, users } from "@/db/schema";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { targetLabel } from "@/lib/target";
import { formatColombo, nowMs } from "@/lib/time";
import { EmptyState, PageHero, heroBtn } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පැවරුම්") };
}

export default async function AssignmentsPage(props: PageProps<"/admin/assignments">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const sp = await props.searchParams;
  const notice = sp.notice === "deleted" ? t("පැවරුම මකා දමන ලදී.") : "";

  const rows = await db
    .select({
      a: assignments,
      institute: institutes.name,
      submitted: sql<number>`(select count(*)::int from ${submissions} where ${submissions.assignmentId} = ${assignments.id})`,
      eligible: sql<number>`(select count(*)::int from ${users} where ${users.role} = 'STUDENT' and ${users.status} = 'ACTIVE' and ${users.grade} = ${assignments.grade} and ${users.medium} = ${assignments.medium} and (${assignments.instituteId} is null or ${users.instituteId} = ${assignments.instituteId}))`,
    })
    .from(assignments)
    .leftJoin(institutes, eq(institutes.id, assignments.instituteId))
    .orderBy(desc(assignments.dueAt));
  const now = nowMs();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="clipboard"
        title={t("පැවරුම්")}
        subtitle={t("ශ්‍රේණිය සහ මාධ්‍යය අනුව සිසුන්ට පැවරුම් පවරන්න. සිසුන් නිම කළ පැවරුම් file ලෙස උඩුගත කරයි.")}
        actions={
          <Link href="/admin/assignments/new" className={heroBtn}>
            + {t("අලුත් පැවරුමක්")}
          </Link>
        }
      />
      {notice && <Alert kind="success">{notice}</Alert>}

      {rows.length === 0 ? (
        <EmptyState>{t("පැවරුම් නැත.")}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ a, institute, submitted, eligible }) => {
            const overdue = a.dueAt.getTime() < now;
            const tone = !a.isPublished ? "red" : overdue ? "sun" : "blue";
            const pct = eligible > 0 ? Math.min(100, Math.round((submitted / eligible) * 100)) : 0;
            return (
              <li key={a.id}>
                <ToneCard tone={tone} href={`/admin/assignments/${a.id}`} className="h-full space-y-3 p-4 pt-5">
                  <div className="flex items-start gap-3">
                    <Tile icon="clipboard" tone={tone} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug text-navy">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{targetLabel({ grade: a.grade, medium: a.medium, instituteName: institute }, t)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!a.isPublished && <Chip tone="red">{t("සඟවා ඇත")}</Chip>}
                    {overdue && <Chip tone="sun">{t("කාලය ඉකුත් වී ඇත")}</Chip>}
                    <Chip tone="cyan">{t("අවසාන දිනය")}: {formatColombo(a.dueAt, lang)}</Chip>
                  </div>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-bright" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{t("ඉදිරිපත් කළ සිසුන් {n}/{m}", { n: submitted, m: eligible })}</p>
                  </div>
                </ToneCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

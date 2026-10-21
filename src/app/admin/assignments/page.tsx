import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
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
        <ul className="space-y-2">
          {rows.map(({ a, institute, submitted, eligible }) => (
            <li key={a.id}>
              <Link href={`/admin/assignments/${a.id}`} className="block space-y-1 card p-4 transition hover:border-primary">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.title}</span>
                  {!a.isPublished && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-muted">{t("සඟවා ඇත")}</span>}
                  {a.dueAt.getTime() < now && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">{t("කාලය ඉකුත් වී ඇත")}</span>}
                </div>
                <p className="text-xs text-muted">{targetLabel({ grade: a.grade, medium: a.medium, instituteName: institute }, t)}</p>
                <p className="text-xs text-muted">
                  {t("අවසාන දිනය")}: {formatColombo(a.dueAt, lang)} · {t("ඉදිරිපත් කළ සිසුන් {n}/{m}", { n: submitted, m: eligible })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

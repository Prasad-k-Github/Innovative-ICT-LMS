import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { Icon } from "@/components/icons";
import { EmptyState, HeroBadge, PageHero, listCard } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { eligibleFor } from "@/lib/assessment";
import { getLang, getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";
import { formatColombo, nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පැවරුම්") };
}

export default async function StudentAssignmentsPage() {
  const user = await requireStudent();
  const t = await getT();
  const lang = await getLang();

  const [list, mine] = await Promise.all([
    db.select().from(assignments).where(eligibleFor(user, assignments)).orderBy(desc(assignments.dueAt)),
    db.select().from(submissions).where(eq(submissions.studentId, user.id)).orderBy(asc(submissions.submittedAt)),
  ]);
  const subOf = new Map(mine.map((s) => [s.assignmentId, s]));
  const now = nowMs();
  const rows = list.map((a) => {
    const s = subOf.get(a.id);
    const overdue = a.dueAt.getTime() < now;
    const status: "graded" | "submitted" | "missed" | "pending" = s?.gradedAt ? "graded" : s ? "submitted" : overdue ? "missed" : "pending";
    return { a, s, status };
  });
  // තවම කළ යුතු ඒවා මුලින්ම (අවසාන දිනය ළඟම ඒවා), ඉතිරි ඒවා පසුව
  const open = rows.filter((r) => r.status === "pending").sort((x, y) => x.a.dueAt.getTime() - y.a.dueAt.getTime());
  const rest = rows.filter((r) => r.status !== "pending");

  const badge = {
    pending: ["bg-amber-100 text-amber-800", t("ඉදිරිපත් කර නැත")],
    submitted: ["bg-blue-100 text-blue-800", t("ඉදිරිපත් කළා")],
    graded: ["bg-green-100 text-green-800", t("ලකුණු දමා ඇත")],
    missed: ["bg-red-100 text-red-800", t("කාලය ඉකුත් වී ඇත")],
  } as const;

  const tone = {
    pending: "bg-amber-100 text-amber-800",
    submitted: "bg-blue-100 text-blue-800",
    graded: "bg-green-100 text-green-800",
    missed: "bg-red-100 text-red-800",
  } as const;
  const tile = {
    pending: "bg-sun-soft text-amber-700",
    submitted: "bg-primary-soft text-primary",
    graded: "bg-emerald-50 text-emerald-700",
    missed: "bg-accent-soft text-accent",
  } as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="clipboard"
        title={t("පැවරුම්")}
        subtitle={t("ඔබට පවරා ඇති පැවරුම් බලා, අවසාන දිනයට පෙර files උඩුගත කරන්න.")}
        badges={
          <>
            <HeroBadge tone="sun">{t("ඉදිරිපත් කළ යුතු පැවරුම්")} · {open.length}</HeroBadge>
          </>
        }
      />
      {!user.medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {rows.length === 0 ? (
        <EmptyState icon="clipboard">{t("දැනට පැවරුම් නැත.")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {[...open, ...rest].map(({ a, s, status }) => (
            <li key={a.id}>
              <Link href={`/dashboard/assignments/${a.id}`} className={`${listCard} group flex items-center gap-4`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile[status]}`}>
                  <Icon name={status === "graded" || status === "submitted" ? "check" : "clipboard"} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-navy">{a.title}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone[status]}`}>{badge[status][1]}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {t("අවසාන දිනය")}: {formatColombo(a.dueAt, lang)}
                    {s?.gradedAt && s.marks !== null && ` · ${t("ලකුණු")}: ${s.marks}${a.maxMarks ? `/${a.maxMarks}` : ""}`}
                  </p>
                </div>
                <Icon name="arrow" className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

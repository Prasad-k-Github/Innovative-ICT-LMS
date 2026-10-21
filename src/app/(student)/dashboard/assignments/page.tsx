import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">{t("පැවරුම්")}</h1>
      {!user.medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">{t("දැනට පැවරුම් නැත.")}</p>
      ) : (
        <ul className="space-y-2">
          {[...open, ...rest].map(({ a, s, status }) => (
            <li key={a.id}>
              <Link href={`/dashboard/assignments/${a.id}`} className="block space-y-1 card p-4 transition hover:border-primary">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.title}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge[status][0]}`}>{badge[status][1]}</span>
                </div>
                <p className="text-xs text-muted">
                  {t("අවසාන දිනය")}: {formatColombo(a.dueAt, lang)}
                  {s?.gradedAt && s.marks !== null && ` · ${t("ලකුණු")}: ${s.marks}${a.maxMarks ? `/${a.maxMarks}` : ""}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

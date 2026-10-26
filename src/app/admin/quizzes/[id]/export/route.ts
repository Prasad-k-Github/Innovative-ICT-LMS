import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizAttempts, quizzes, users } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { gradeLabel } from "@/lib/constants";
import { csvDate, csvResponse } from "@/lib/csv";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// එක් Quiz එකක ප්‍රතිඵල CSV ලෙස
export async function GET(_req: Request, ctx: RouteContext<"/admin/quizzes/[id]/export">) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const [q] = await db.select({ title: quizzes.title }).from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!q) return new Response("Not found", { status: 404 });
  const t = await getT();
  const rows = await db
    .select({ name: users.name, indexNo: users.indexNo, grade: users.grade, alYear: users.alYear, phone: users.phone, score: quizAttempts.score, total: quizAttempts.total, submittedAt: quizAttempts.submittedAt, startedAt: quizAttempts.startedAt })
    .from(quizAttempts)
    .innerJoin(users, eq(users.id, quizAttempts.studentId))
    .where(eq(quizAttempts.quizId, id))
    .orderBy(asc(users.name));
  const header = ["Index අංකය", "නම", "ශ්‍රේණිය", "දුරකතනය", "ලකුණු", "මුළු ලකුණු", "ප්‍රතිශතය %", "ආරම්භ කළේ", "ඉදිරිපත් කළේ"].map((h) => t(h));
  return csvResponse(
    header,
    rows.map((r) => [
      r.indexNo ?? "",
      r.name,
      gradeLabel(r.grade, r.alYear, t),
      r.phone,
      r.submittedAt ? r.score : "",
      r.submittedAt ? r.total : "",
      r.submittedAt && r.total ? Math.round(((r.score ?? 0) / r.total) * 100) : "",
      csvDate(r.startedAt),
      csvDate(r.submittedAt),
    ]),
    `quiz-${id.slice(0, 8)}.csv`,
  );
}

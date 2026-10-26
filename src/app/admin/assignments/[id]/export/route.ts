import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assignments, submissions, users } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { gradeLabel } from "@/lib/constants";
import { csvDate, csvResponse } from "@/lib/csv";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// එක් පැවරුමක ඉදිරිපත් කිරීම් සහ ලකුණු CSV ලෙස
export async function GET(_req: Request, ctx: RouteContext<"/admin/assignments/[id]/export">) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const [a] = await db.select({ maxMarks: assignments.maxMarks }).from(assignments).where(eq(assignments.id, id)).limit(1);
  if (!a) return new Response("Not found", { status: 404 });
  const t = await getT();
  const rows = await db
    .select({ name: users.name, indexNo: users.indexNo, grade: users.grade, alYear: users.alYear, phone: users.phone, marks: submissions.marks, feedback: submissions.feedback, submittedAt: submissions.submittedAt, gradedAt: submissions.gradedAt })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .where(eq(submissions.assignmentId, id))
    .orderBy(asc(users.name));
  const header = ["Index අංකය", "නම", "ශ්‍රේණිය", "දුරකතනය", "ලකුණු", "මුළු ලකුණු", "ප්‍රතිචාරය (Feedback)", "ඉදිරිපත් කළේ", "ලකුණු දැමූ දිනය"].map((h) => t(h));
  return csvResponse(
    header,
    rows.map((r) => [r.indexNo ?? "", r.name, gradeLabel(r.grade, r.alYear, t), r.phone, r.gradedAt ? (r.marks ?? "") : "", a.maxMarks ?? "", r.feedback ?? "", csvDate(r.submittedAt), csvDate(r.gradedAt)]),
    `assignment-${id.slice(0, 8)}.csv`,
  );
}

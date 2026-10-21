import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { institutes, users } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, isAdminRole } from "@/lib/session";
import { parseFilters, studentWhere } from "@/lib/student-query";

export const dynamic = "force-dynamic";

// CSV injection වැළැක්වීම: =, +, -, @ වලින් ආරම්භ වන අගයන් ඉදිරියට ' යොදයි
function cell(value: unknown) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return new Response("Forbidden", { status: 403 });

  const t = await getT();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await db
    .select({
      name: users.name,
      school: users.school,
      grade: users.grade,
      alYear: users.alYear,
      medium: users.medium,
      phone: users.phone,
      email: users.email,
      status: users.status,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      institute: institutes.name,
    })
    .from(users)
    .leftJoin(institutes, eq(institutes.id, users.instituteId))
    .where(studentWhere(parseFilters(sp)))
    .orderBy(asc(users.grade), desc(users.createdAt));

  const header = ["නම", "පාසල", "ශ්‍රේණිය", "මාධ්‍යය", "ආයතනය", "දුරකතනය", "Email", "තත්ත්වය", "Email තහවුරු", "ලියාපදිංචි දිනය"].map((h) => t(h));
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.school,
        gradeLabel(r.grade, r.alYear, t),
        r.medium ? t(MEDIUM_LABELS[r.medium]) : "",
        r.institute ?? "",
        r.phone,
        r.email,
        r.status,
        r.emailVerified ? t("ඔව්") : t("නැත"),
        r.createdAt.toISOString().slice(0, 10),
      ]
        .map(cell)
        .join(","),
    );
  }

  // UTF-8 BOM: Excel හි සිංහල අක්ෂර නිවැරදිව පෙන්වීමට
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="students.csv"',
      "Cache-Control": "no-store",
    },
  });
}

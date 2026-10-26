import { IMPORT_TEMPLATE } from "@/lib/student-import";
import { getCurrentUser, isAdminUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Import සඳහා නිදර්ශන CSV ආකෘතිය
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) return new Response("Forbidden", { status: 403 });
  return new Response("﻿" + IMPORT_TEMPLATE, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="students-template.csv"', "Cache-Control": "no-store" },
  });
}

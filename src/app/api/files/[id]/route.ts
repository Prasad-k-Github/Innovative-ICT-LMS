import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissionFiles, submissions } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// සිසුන් උඩුගත කළ files download කිරීම: Admin ට ඕනෑම file එකක්, සිසුවාට තමාගේ file පමණි.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ file: submissionFiles, studentId: submissions.studentId })
    .from(submissionFiles)
    .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
    .where(eq(submissionFiles.id, id))
    .limit(1);
  if (!row || (!isAdminRole(user.role) && row.studentId !== user.id)) return new Response("Not found", { status: 404 });

  const f = row.file;
  const ascii = f.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(f.size),
      // සැමවිටම download ලෙස (browser තුළ ක්‍රියාත්මක වීම වැළැක්වීමට)
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

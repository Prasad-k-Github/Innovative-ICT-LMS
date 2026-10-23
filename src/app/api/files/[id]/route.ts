import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissionFiles, submissions } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { readBlob } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// සිසුන් උඩුගත කළ files download කිරීම: Admin ට ඕනෑම file එකක්, සිසුවාට තමාගේ file පමණි.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  // Availability: ලොකු download සඳහා පරිශීලකයෙකුට විනාඩි 10කට 60ක්
  if (!(await rateLimit(`dl:${user.id}`, 60, 10 * 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });

  const [row] = await db
    .select({ file: submissionFiles, studentId: submissions.studentId })
    .from(submissionFiles)
    .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
    .where(eq(submissionFiles.id, id))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  if (!isAdminRole(user.role) && row.studentId !== user.id) {
    // වෙනත් සිසුවෙකුගේ file එකක් ඉල්ලීම: 404 (පවතින බව හෙළි නොකරයි) සහ log කරයි
    await audit(user.id, "access.denied", `/api/files/${id}`, `role:${user.role}`, user.id);
    return new Response("Not found", { status: 404 });
  }

  const f = row.file;
  // Integrity: ගබඩා කළ SHA-256 සමඟ දැන් ඇති දත්ත සසඳයි (database හි file වෙනස් කර ඇත්නම් ලබා නොදේ)
  let bytes: Buffer;
  try {
    bytes = await readBlob(f);
  } catch (e) {
    console.error("file read failed", id, e);
    return new Response("File unavailable", { status: 503 });
  }
  if (f.sha256) {
    const actual = createHash("sha256").update(bytes).digest();
    const expected = Buffer.from(f.sha256, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await audit(user.id, "file.integrity_failure", f.filename.slice(0, 150), id, row.studentId);
      return new Response("File integrity check failed", { status: 500 });
    }
  }
  if (isAdminRole(user.role)) await audit(user.id, "file.download", f.filename.slice(0, 150), undefined, row.studentId);
  const ascii = f.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
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

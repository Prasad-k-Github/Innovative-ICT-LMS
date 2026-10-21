import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userAvatars } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Profile ඡායාරූපය: පරිශීලකයාට තමාගේ එක පමණි; Admin ලාට සියල්ලම (සිසුන් ලැයිස්තුවේ පෙන්වීමට).
export async function GET(req: NextRequest, ctx: RouteContext<"/api/avatar/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  if (!isAdminRole(user.role) && user.id !== id) {
    await audit(user.id, "access.denied", `/api/avatar/${id}`, `role:${user.role}`, user.id);
    return new Response("Not found", { status: 404 });
  }
  // ලැයිස්තුවක ඡායාරූප බොහොමයක් එකවර ඉල්ලිය හැකි නිසා ඉහළ සීමාවක්
  if (!(await rateLimit(`avatar-get:${user.id}`, 600, 10 * 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });

  const [a] = await db.select().from(userAvatars).where(eq(userAvatars.userId, id)).limit(1);
  if (!a) return new Response("Not found", { status: 404 });

  // Integrity: ගබඩා කළ SHA-256 සමඟ සසඳයි
  const actual = createHash("sha256").update(a.data).digest();
  const expected = Buffer.from(a.sha256, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await audit(user.id, "file.integrity_failure", "avatar", id, id);
    return new Response("Integrity check failed", { status: 500 });
  }

  const etag = `"${a.sha256.slice(0, 32)}"`;
  const headers = {
    ETag: etag,
    "Cache-Control": "private, no-cache", // සෑම විටම ETag මගින් නැවත සත්‍යාපනය (වෙනස් වූ විගස යාවත්කාලීන වේ)
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(a.data), { headers: { ...headers, "Content-Type": a.mime, "Content-Length": String(a.size) } });
}

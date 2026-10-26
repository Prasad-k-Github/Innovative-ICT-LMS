import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentAttachments } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { readBlob } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser, isAdminUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sage ට යැවූ ඡායාරූප / PDF: ඒවා යැවූ සිසුවාට සහ Admin ට පමණි
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/agent-file/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  if (!(await rateLimit(`agentfile:${user.id}`, 120, 10 * 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });

  const [f] = await db.select().from(agentAttachments).where(eq(agentAttachments.id, id)).limit(1);
  if (!f) return new Response("Not found", { status: 404 });
  if (!isAdminUser(user) && f.userId !== user.id) {
    await audit(user.id, "access.denied", `/api/agent-file/${id}`, `role:${user.role}`, user.id);
    return new Response("Not found", { status: 404 });
  }
  let bytes: Buffer;
  try {
    bytes = await readBlob(f);
  } catch (e) {
    console.error("agent file read failed", id, e);
    return new Response("File unavailable", { status: 503 });
  }
  const isImage = f.mime.startsWith("image/");
  const ascii = f.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(f.size),
      // ඡායාරූප <img> තුළ පෙන්වයි; PDF සැමවිටම download ලෙස (browser තුළ ක්‍රියාත්මක වීම වැළැක්වීමට)
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

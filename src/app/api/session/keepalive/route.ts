import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sessionStatus } from "@/lib/session";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

// පරිශීලක ක්‍රියාකාරිත්වය (click, type, "දිගටම සිටින්න") සඳහා: idle කාලය නැවත ආරම්භ කරයි. උපරිම (absolute) කාලය දිගු නොකරයි.
// CSRF: SameSite=Lax cookie + අභිරුචි header එකක් (වෙනත් site එකකින් form/fetch මගින් මෙය යැවිය නොහැක) සහ Origin පරීක්ෂාව
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (req.headers.get("x-ict-keepalive") !== "1" || (origin && origin !== req.nextUrl.origin)) return new Response("Forbidden", { status: 403 });
  const s = await sessionStatus(true);
  if (s.state !== "ok") return Response.json({ ok: false, reason: s.state === "ended" ? s.reason : "expired" }, { status: 401, headers: noStore });
  if (!(await rateLimit(`sesskeep:${s.userId}`, 200, 10 * 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "30" } });
  return Response.json({ ok: true, idleLeftMs: s.idleLeftMs, absLeftMs: s.absLeftMs }, { headers: noStore });
}

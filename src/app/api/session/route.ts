import { rateLimit } from "@/lib/rate-limit";
import { sessionStatus } from "@/lib/session";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

// Browser එකේ SessionGuard මෙය විටින් විට කියවයි: ඉතිරි කාලය, සහ session අවසන් වී ඇත්නම් හේතුව.
// පසුබිම් පරීක්ෂාවක් නිසා idle කාලය දිගු නොකරයි (touch නැත).
export async function GET() {
  const s = await sessionStatus(false);
  if (s.state !== "ok") return Response.json({ ok: false, reason: s.state === "ended" ? s.reason : "expired" }, { status: 401, headers: noStore });
  if (!(await rateLimit(`sesspoll:${s.userId}`, 300, 10 * 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "30" } });
  return Response.json({ ok: true, idleLeftMs: s.idleLeftMs, absLeftMs: s.absLeftMs }, { headers: noStore });
}

import { authorOf, recentChat } from "@/lib/community-data";
import { canAccessRoom, isRoom } from "@/lib/community";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser, isAdminRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Live chat: කාමරයේ අවසන් පණිවිඩ 50 (කාමරයට ප්‍රවේශය ඇති අයට පමණි). සැඟවූ පණිවිඩ පෙනෙන්නේ Admin ට පමණි
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const room = new URL(req.url).searchParams.get("room") ?? "";
  if (!isRoom(room) || !canAccessRoom(user, room)) return new Response("Forbidden", { status: 403 });
  if (!(await rateLimit(`chatpoll:${user.id}`, 90, 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "30" } });
  const t = await getT();
  const rows = await recentChat(room, isAdminRole(user.role));
  const messages = rows.map((r) => {
    const a = authorOf(r, t);
    return { id: r.id, body: r.body, hidden: r.hidden, at: r.createdAt.toISOString(), name: a.name, sub: a.sub, staff: a.staff, mine: r.authorId === user.id };
  });
  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

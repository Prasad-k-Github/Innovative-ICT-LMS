import { getT } from "@/lib/i18n/server";
import { loadNotifications } from "@/lib/notifications-data";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// පරිශීලකයාගේම දැනුම්දීම් (bell panel එක විටින් විට මෙය කියවයි)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  // Availability: poll කිරීම අධික ලෙස වැළැක්වීමට (සාමාන්‍ය භාවිතය විනාඩියකට 1ක්)
  if (!(await rateLimit(`notif:${user.id}`, 400, 10 * 60_000))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
  const data = await loadNotifications(user.id, await getT());
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

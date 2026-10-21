import { getT } from "@/lib/i18n/server";
import { loadNotifications } from "@/lib/notifications-data";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// පරිශීලකයාගේම දැනුම්දීම් (bell panel එක විටින් විට මෙය කියවයි)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const data = await loadNotifications(user.id, await getT());
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

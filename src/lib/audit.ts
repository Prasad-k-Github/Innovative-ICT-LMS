import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(
  actorId: string | null,
  action: string,
  target?: string,
  details?: string,
  targetId?: string,
) {
  try {
    await db.insert(auditLogs).values({ actorId, action, target, details, targetId });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { requireUser } from "@/lib/session";

// සෑම විටම තමාගේම දැනුම්දීම් පමණක් (where userId = me)

export async function markNotificationReadAction(id: string) {
  const me = await requireUser();
  if (!UUID_RE.test(id)) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, me.id), isNull(notifications.readAt)));
}

export async function markAllNotificationsReadAction() {
  const me = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
}

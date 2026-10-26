"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
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

// පැති මෙනුවේ කොටසක් බැලූ විට එහි දැනුම්දීම් කිහිපයක් එකවර කියවූ ලෙස සලකුණු කරයි
export async function markNotificationsReadAction(ids: string[]) {
  const me = await requireUser();
  const clean = (Array.isArray(ids) ? ids : []).filter((i) => typeof i === "string" && UUID_RE.test(i)).slice(0, 50);
  if (clean.length === 0) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), inArray(notifications.id, clean), isNull(notifications.readAt)));
}

// සියලු දැනුම්දීම් ඉවත් කිරීම (තමාගේ ඒවා පමණි)
export async function clearAllNotificationsAction() {
  const me = await requireUser();
  await db.delete(notifications).where(eq(notifications.userId, me.id));
}

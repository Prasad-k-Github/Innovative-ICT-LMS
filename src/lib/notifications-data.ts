import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { T } from "./i18n/core";
import { renderNotification, type RenderedNotification } from "./notification-render";

export type NotificationItem = RenderedNotification & { id: string; read: boolean; at: string };
export type NotificationsPayload = { unread: number; items: NotificationItem[] };

const LIMIT = 30;

// පරිශීලකයාගේ නවතම දැනුම්දීම් (වත්මන් භාෂාවට පරිවර්තනය කර)
export async function loadNotifications(userId: string, t: T): Promise<NotificationsPayload> {
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(LIMIT),
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return {
    unread: n,
    items: rows.map((r) => ({
      id: r.id,
      read: r.readAt !== null,
      at: r.createdAt.toISOString(),
      ...renderNotification(r.type, r.data, t),
    })),
  };
}

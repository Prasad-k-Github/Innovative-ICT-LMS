import "server-only";
import { and, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { gradeGroup } from "./constants";
import type { NotificationData, NotificationType } from "./notification-render";

// සටහන: දැනුම්දීම් කිසිවිටෙක ප්‍රධාන ක්‍රියාව අසාර්ථක නොකළ යුතුය (සියල්ල try/catch තුළ)

const KEEP_DAYS = 90;

async function insertFor(userIds: string[], type: NotificationType, data: NotificationData) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  try {
    await db.insert(notifications).values(ids.map((userId) => ({ userId, type, data })));
    // පරණ දැනුම්දීම් ඉඳහිට ඉවත් කරයි
    if (Math.random() < 0.01) {
      await db.delete(notifications).where(lt(notifications.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)));
    }
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function notifyUsers(userIds: string[], type: NotificationType, data: NotificationData = {}) {
  await insertFor(userIds, type, data);
}

// සියලු Admin ලා සහ Super Admin (ක්‍රියාව කළ අයව හැර)
export async function notifyAdmins(type: NotificationType, data: NotificationData = {}, exceptId?: string) {
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.role, ["ADMIN", "SUPER_ADMIN"]), eq(users.status, "ACTIVE"), exceptId ? ne(users.id, exceptId) : undefined));
    await insertFor(rows.map((r) => r.id), type, data);
  } catch (e) {
    console.error("notifyAdmins failed", e);
  }
}

// ශ්‍රේණිය + මාධ්‍යය (+ ආයතනය) ට අදාළ සක්‍රීය සිසුන්
export async function notifyStudentsFor(
  target: { grade: number; medium: "SINHALA" | "ENGLISH" | null; instituteId?: string | null },
  type: NotificationType,
  data: NotificationData = {},
) {
  try {
    if (!target.medium) return;
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "STUDENT"),
          eq(users.status, "ACTIVE"),
          inArray(users.grade, gradeGroup(target.grade)),
          eq(users.medium, target.medium),
          target.instituteId ? eq(users.instituteId, target.instituteId) : undefined,
        ),
      );
    await insertFor(rows.map((r) => r.id), type, data);
  } catch (e) {
    console.error("notifyStudentsFor failed", e);
  }
}


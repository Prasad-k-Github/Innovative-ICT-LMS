import "server-only";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { classLinks } from "@/db/schema";
import { gradeGroup } from "@/lib/constants";
import type { SessionUser } from "@/lib/session";

// සිසුවාට දැනට පෙනිය යුතු Zoom links: ඔහුගේ ශ්‍රේණිය + මාධ්‍යය (+ ආයතනය) සහ තවම කල් නොඉකුත් වූ ඒවා පමණි.
// කල් ඉකුත් වීම database query එකේදීම පරීක්ෂා කරන නිසා පැය 24න් පසු link එක server එකෙන්ම නොයැවේ.
export async function activeClassLinksFor(user: Pick<SessionUser, "grade" | "medium" | "instituteId">, now: Date = new Date()) {
  if (!user.medium) return [];
  return db
    .select()
    .from(classLinks)
    .where(
      and(
        inArray(classLinks.grade, gradeGroup(user.grade)),
        eq(classLinks.medium, user.medium),
        gt(classLinks.expiresAt, now),
        user.instituteId ? or(isNull(classLinks.instituteId), eq(classLinks.instituteId, user.instituteId)) : isNull(classLinks.instituteId),
      ),
    )
    .orderBy(desc(classLinks.createdAt));
}

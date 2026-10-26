import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { newsletters } from "@/db/schema";
import { gradeGroup } from "@/lib/constants";
import type { SessionUser } from "@/lib/session";

// සිසුවාට පෙනෙන පළ කළ Newsletters: ශ්‍රේණිය / මාධ්‍යය / ආයතනය හිස් (සියල්ලන්ට) හෝ සිසුවාට ගැළපෙන ඒවා පමණි
function visibleTo(user: Pick<SessionUser, "grade" | "medium" | "instituteId">) {
  return and(
    eq(newsletters.published, true),
    or(isNull(newsletters.grade), inArray(newsletters.grade, gradeGroup(user.grade))),
    user.medium ? or(isNull(newsletters.medium), eq(newsletters.medium, user.medium)) : isNull(newsletters.medium),
    user.instituteId ? or(isNull(newsletters.instituteId), eq(newsletters.instituteId, user.instituteId)) : isNull(newsletters.instituteId),
  );
}

export async function newslettersFor(user: Pick<SessionUser, "grade" | "medium" | "instituteId">, limit = 30) {
  return db
    .select({ id: newsletters.id, title: newsletters.title, summary: newsletters.summary, publishedAt: newsletters.publishedAt })
    .from(newsletters)
    .where(visibleTo(user))
    .orderBy(desc(newsletters.publishedAt))
    .limit(limit);
}

export async function newsletterFor(user: Pick<SessionUser, "grade" | "medium" | "instituteId">, id: string) {
  const [row] = await db.select().from(newsletters).where(and(eq(newsletters.id, id), visibleTo(user))).limit(1);
  return row ?? null;
}

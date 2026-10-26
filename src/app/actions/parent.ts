"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { verifyUnsubscribe } from "@/lib/parent-summary";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// ප්‍රසිද්ධ action (ලොග් වීමක් නැත): දෙමාපියන් Email එකේ link එකෙන් සාරාංශ ලැබීම නවත්වයි.
// HMAC අත්සන වලංගු නම් පමණක් ක්‍රියා කරයි + IP අනුව rate-limit
export async function parentUnsubscribeAction(formData: FormData): Promise<void> {
  const id = formData.get("u")?.toString() ?? "";
  const sig = formData.get("s")?.toString() ?? "";
  if (!(await rateLimit(`parent-unsub:${await clientIp()}`, 20, 60 * 60_000))) return;
  if (!id || !sig || !verifyUnsubscribe(id, sig)) return;
  const done = await db
    .update(users)
    .set({ parentOptInAt: null })
    .where(and(eq(users.id, id), eq(users.role, "STUDENT"), isNotNull(users.parentOptInAt)))
    .returning({ id: users.id });
  if (done.length) await audit(null, "parent.unsubscribe", id, undefined, id);
}

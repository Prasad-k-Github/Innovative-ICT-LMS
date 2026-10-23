import "server-only";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "./audit";
import { notifyUsers } from "./notify";
import { parseColombo } from "./time";

// අත්හිටුවීමේ කාල: තාවකාලික (දින ගණන / තෝරාගත් දිනයක් දක්වා) හෝ ස්ථිර
export { SUSPEND_DAY_OPTIONS } from "./suspension-config";
import { SUSPEND_DAY_OPTIONS } from "./suspension-config";
export const SUSPEND_REASON_MAX = 200;
const MAX_FUTURE_DAYS = 366;

export type Suspension = { until: Date | null; reason: string | null };
export type SuspensionParse = { ok: true; value: Suspension } | { ok: false; error: "bad-date" };

// duration: "1" | "3" | "7" | "14" | "30" | "custom" | "permanent"; until: <input type=date> (YYYY-MM-DD, ශ්‍රී ලංකා වේලාව, එම දිනය අවසානය දක්වා)
export function parseSuspension(formData: FormData, now = Date.now()): SuspensionParse {
  const duration = formData.get("duration")?.toString() ?? "permanent";
  const reasonRaw = (formData.get("reason")?.toString() ?? "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, SUSPEND_REASON_MAX);
  const reason = reasonRaw || null;

  if (duration === "permanent") return { ok: true, value: { until: null, reason } };
  const days = Number(duration);
  if ((SUSPEND_DAY_OPTIONS as readonly number[]).includes(days)) {
    return { ok: true, value: { until: new Date(now + days * 86_400_000), reason } };
  }
  if (duration === "custom") {
    const d = parseColombo(`${formData.get("until")?.toString() ?? ""}T23:59`);
    if (!d || d.getTime() <= now || d.getTime() > now + MAX_FUTURE_DAYS * 86_400_000) return { ok: false, error: "bad-date" };
    return { ok: true, value: { until: d, reason } };
  }
  return { ok: false, error: "bad-date" };
}

// කාලය ඉකුත් වූ තාවකාලික අත්හිටුවීම් ස්වයංක්‍රීයව ඉවත් කරයි (එක් සිසුවෙකු සඳහා හෝ සියල්ල). ඉවත් කළ ගණන ලබා දෙයි
export async function releaseExpiredSuspensions(userId?: string): Promise<number> {
  const rows = await db
    .update(users)
    .set({ status: "ACTIVE", suspendedUntil: null, suspendReason: null, suspendedAt: null })
    .where(
      and(
        eq(users.role, "STUDENT"),
        eq(users.status, "SUSPENDED"),
        isNotNull(users.suspendedUntil),
        lte(users.suspendedUntil, new Date()),
        userId ? eq(users.id, userId) : undefined,
      ),
    )
    .returning({ id: users.id, email: users.email });
  for (const r of rows) await audit(null, "student.auto_activate", r.email, undefined, r.id);
  if (rows.length) await notifyUsers(rows.map((r) => r.id), "ACCOUNT_REACTIVATED");
  return rows.length;
}

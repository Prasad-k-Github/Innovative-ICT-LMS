import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";

// Database-backed rate limiter: serverless (Vercel) හි instance කිහිපයක් අතර බෙදාගනී,
// restart වලින් නැති නොවේ. එක් INSERT ... ON CONFLICT මගින් atomic ලෙස ගණන් කරයි (fixed window).

export async function clientIp() {
  const h = await headers();
  // Vercel මෙම headers වෙතම සැබෑ client IP එක සකසයි (client ට වෙනස් කළ නොහැක)
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const secs = (ms: number) => ms / 1000;

// උත්සාහයක් ගණන් කර, තවමත් සීමාව තුළදැයි (true) ආපසු දෙයි
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const res = await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${secs(windowMs)}::double precision) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${secs(windowMs)}::double precision) then now() else rate_limits.window_start end
    returning count`);
  // කලාතුරකින් පැරණි පේළි පිරිසිදු කරයි
  if (Math.random() < 0.01) {
    await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  }
  return Number((res.rows[0] as { count: number | string }).count) <= limit;
}

// ගණන් නොකර පමණක් පරීක්ෂා කරයි (වැරදි උත්සාහ පමණක් ගණන් කිරීමට rateHit සමඟ)
export async function rateCheck(key: string, limit: number, windowMs: number): Promise<boolean> {
  const res = await db.execute(sql`
    select count from rate_limits
    where key = ${key} and window_start >= now() - make_interval(secs => ${secs(windowMs)}::double precision)`);
  const row = res.rows[0] as { count: number | string } | undefined;
  return !row || Number(row.count) < limit;
}

// එක් (වැරදි) උත්සාහයක් ගණන් කරයි
export async function rateHit(key: string, windowMs: number): Promise<void> {
  await rateLimit(key, Number.MAX_SAFE_INTEGER, windowMs);
}

// සාර්ථක login එකකින් පසු එම key එකේ ගණන ඉවත් කිරීමට
export async function rateLimitReset(key: string) {
  await db.execute(sql`delete from rate_limits where key = ${key}`);
}

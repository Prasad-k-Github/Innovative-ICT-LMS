import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

// Availability: ධාවන තත්ත්ව පරීක්ෂාව (load balancer / uptime monitor සඳහා). කිසිදු සංවේදී තොරතුරක් නොදෙයි.
export async function GET() {
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("db timeout")), 3000)),
    ]);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { timingSafeEqual } from "node:crypto";
import { sendWeeklySummaries } from "@/lib/parent-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron (vercel.json) සතිපතා කැඳවයි. CRON_SECRET සකසා ඇති විට Vercel විසින් "Authorization: Bearer <secret>" යවයි
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not configured", { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return new Response("Unauthorized", { status: 401 });
  const result = await sendWeeklySummaries();
  return Response.json(result);
}

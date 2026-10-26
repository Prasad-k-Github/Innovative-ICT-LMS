import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentAttachments, agentMessages, users } from "@/db/schema";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";

// Sage / AI සහායකයා භාවිත සීමා සහ පිරිවැය අනතුරු ඇඟවීම.
// සියල්ල environment variables වලින් (0 = එම සීමාව අක්‍රිය):
//   AGENT_DAILY_LIMIT           එක් සිසුවෙකුට දිනකට පණිවිඩ (පෙරනිමි 30)
//   AGENT_GLOBAL_DAILY_LIMIT    සියලු සිසුන් එකතුව දිනකට පණිවිඩ (පෙරනිමි 2000): අනපේක්ෂිත භාවිත වැඩිවීමකදී පිරිවැය පාලනයට
//   AGENT_MONTHLY_BUDGET_USD    මාසික අයවැය (පෙරනිමි 0 = අනතුරු ඇඟවීම් නැත)
//   AGENT_COST_PER_MESSAGE_USD  පණිවිඩයකට ආසන්න පිරිවැය (පෙරනිමි 0.003); ඇමුණුම් සහිත පණිවිඩයකට ×4
//   AGENT_BUDGET_HARD           "true" නම් අයවැය 100% ඉක්මවූ විට සිසුන්ට AI නවතයි (පෙරනිමි: අනතුරු ඇඟවීම පමණි)
function num(name: string, def: number, max = 1_000_000) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : def;
}

export function agentLimits() {
  return {
    daily: Math.floor(num("AGENT_DAILY_LIMIT", 30, 10_000)),
    globalDaily: Math.floor(num("AGENT_GLOBAL_DAILY_LIMIT", 2000)),
    monthlyBudget: num("AGENT_MONTHLY_BUDGET_USD", 0, 1_000_000),
    costPerMessage: num("AGENT_COST_PER_MESSAGE_USD", 0.003, 100),
    hard: process.env.AGENT_BUDGET_HARD === "true",
  };
}

const COLOMBO_MS = 5.5 * 3_600_000; // Asia/Colombo = UTC+5:30 (DST නැත)

// ශ්‍රී ලංකා වේලාවෙන් දිනයේ / මාසයේ ආරම්භය (UTC Date ලෙස)
export function colomboDayStart(now = Date.now()) {
  const local = new Date(now + COLOMBO_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - COLOMBO_MS);
}
export function colomboMonthStart(now = Date.now()) {
  const local = new Date(now + COLOMBO_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - COLOMBO_MS);
}
export const colomboMonthKey = (now = Date.now()) => new Date(now + COLOMBO_MS).toISOString().slice(0, 7);

export type UsageLevel = "ok" | "warn" | "over";
export type AgentUsage = {
  today: number;
  month: number;
  monthWithFiles: number; // ඇමුණුම් සහිත පණිවිඩ (පිරිවැය වැඩි)
  cost: number; // මාසයේ ආසන්න පිරිවැය (USD)
  budget: number;
  pct: number | null; // අයවැයෙන් භාවිත %
  level: UsageLevel;
};

// WARN_AT: අයවැයෙන් 80% ට අනතුරු ඇඟවීම
export const WARN_AT = 0.8;

export async function agentUsage(now = Date.now()): Promise<AgentUsage> {
  const lim = agentLimits();
  const dayStart = colomboDayStart(now);
  const monthStart = colomboMonthStart(now);
  const [row] = await db
    .select({
      today: sql<number>`count(*) filter (where ${agentMessages.createdAt} >= ${dayStart})::int`,
      month: sql<number>`count(*)::int`,
    })
    .from(agentMessages)
    .where(and(eq(agentMessages.role, "user"), gte(agentMessages.createdAt, monthStart)));
  const [files] = await db
    .select({ n: sql<number>`count(distinct ${agentAttachments.messageId})::int` })
    .from(agentAttachments)
    .innerJoin(agentMessages, eq(agentMessages.id, agentAttachments.messageId))
    .where(gte(agentMessages.createdAt, monthStart));
  const month = row?.month ?? 0;
  const withFiles = files?.n ?? 0;
  const cost = (month + withFiles * 3) * lim.costPerMessage;
  const pct = lim.monthlyBudget > 0 ? cost / lim.monthlyBudget : null;
  const level: UsageLevel = pct === null ? "ok" : pct >= 1 ? "over" : pct >= WARN_AT ? "warn" : "ok";
  return { today: row?.today ?? 0, month, monthWithFiles: withFiles, cost, budget: lim.monthlyBudget, pct, level };
}

export type AgentBlock = "daily" | "global" | "budget" | null;

// පණිවිඩයක් යැවීමට පෙර: සිසුවාගේ දෛනික සීමාව, සමස්ත දෛනික සීමාව, (hard නම්) මාසික අයවැය
export async function agentBlockReason(userId: string, now = Date.now()): Promise<AgentBlock> {
  const lim = agentLimits();
  if (lim.daily > 0) {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agentMessages)
      .where(and(eq(agentMessages.userId, userId), eq(agentMessages.role, "user"), gte(agentMessages.createdAt, colomboDayStart(now))));
    if ((r?.n ?? 0) >= lim.daily) return "daily";
  }
  if (lim.globalDaily > 0 || (lim.hard && lim.monthlyBudget > 0)) {
    const u = await agentUsage(now);
    if (lim.globalDaily > 0 && u.today >= lim.globalDaily) return "global";
    if (lim.hard && u.level === "over") return "budget";
  }
  return null;
}

// අයවැයෙන් 80% / 100% ඉක්මවූ විට Super Admin ලාට Email (එක් මට්ටමකට මාසයකට එක් වරක් පමණි). පණිවිඩයක් යැවූ පසු කැඳවයි; අසාර්ථක වීම AI පිළිතුරට බලපාන්නේ නැත
export async function maybeSendBudgetAlert(now = Date.now()) {
  try {
    const u = await agentUsage(now);
    if (u.level === "ok" || u.pct === null) return;
    const key = `agent-budget-alert:${u.level}:${colomboMonthKey(now)}`;
    if (!(await rateLimit(key, 1, 32 * 86_400_000))) return;
    const admins = await db.select({ email: users.email }).from(users).where(and(eq(users.role, "SUPER_ADMIN"), eq(users.status, "ACTIVE")));
    const pctText = Math.round(u.pct * 100);
    const subjectSi = u.level === "over" ? "Sage: මාසික අයවැය ඉක්මවා ඇත" : "Sage: මාසික අයවැයෙන් 80% ක් භාවිතා වී ඇත";
    const subjectEn = u.level === "over" ? "Sage: monthly budget exceeded" : "Sage: 80% of the monthly budget used";
    const si = `ආසන්න පිරිවැය $${u.cost.toFixed(2)} / අයවැය $${u.budget.toFixed(2)} (${pctText}%). මෙම මාසයේ පණිවිඩ ${u.month}ක්.${agentLimits().hard && u.level === "over" ? " AGENT_BUDGET_HARD සක්‍රිය නිසා සිසුන්ට AI දැන් නවතා ඇත." : ""}`;
    const en = `Estimated cost $${u.cost.toFixed(2)} of a $${u.budget.toFixed(2)} budget (${pctText}%). ${u.month} messages this month.`;
    for (const a of admins) {
      await sendMail({ to: a.email, subject: `${subjectSi} / ${subjectEn}`, html: `<p>${si}</p><p>${en}</p>`, text: `${si}\n\n${en}` });
    }
  } catch (e) {
    console.error("budget alert failed", e);
  }
}

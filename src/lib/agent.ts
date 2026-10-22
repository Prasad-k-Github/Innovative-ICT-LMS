import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentMessages, agentWallets, quizAttempts } from "@/db/schema";
import { finalizeExpired } from "@/lib/assessment";
import { AGENT_CONTEXT_MESSAGES, AGENT_HISTORY_LIMIT, DEFAULT_FREE_CREDITS } from "@/lib/agent-config";
import { demoReply } from "@/lib/agent-prompt";

/* ------------------------------ Credits ------------------------------ */

export function freeCredits() {
  const n = Number(process.env.AGENT_FREE_CREDITS);
  return Number.isInteger(n) && n >= 0 && n <= 10_000 ? n : DEFAULT_FREE_CREDITS;
}

// සෑම සිසුවෙකුටම පළමු වරට free credits ලැබේ (wallet එක ඉබේම සෑදේ)
export async function ensureWallet(userId: string) {
  const free = freeCredits();
  await db
    .insert(agentWallets)
    .values({ userId, balance: free, granted: free, conversationId: randomUUID() })
    .onConflictDoNothing();
  const [w] = await db.select().from(agentWallets).where(eq(agentWallets.userId, userId)).limit(1);
  return w;
}

// Credit 1ක් අඩු කරයි (atomic — එකවර පණිවිඩ කිහිපයක් යැවුවත් balance නොඅඩු වේ). balance නැත්නම් null
export async function spendCredit(userId: string): Promise<number | null> {
  const [row] = await db
    .update(agentWallets)
    .set({ balance: sql`${agentWallets.balance} - 1`, used: sql`${agentWallets.used} + 1`, updatedAt: new Date() })
    .where(and(eq(agentWallets.userId, userId), sql`${agentWallets.balance} > 0`))
    .returning({ balance: agentWallets.balance });
  return row ? row.balance : null;
}

export async function refundCredit(userId: string) {
  await db
    .update(agentWallets)
    .set({ balance: sql`${agentWallets.balance} + 1`, used: sql`GREATEST(${agentWallets.used} - 1, 0)`, updatedAt: new Date() })
    .where(eq(agentWallets.userId, userId));
}

export async function addCredits(userId: string, n: number) {
  await ensureWallet(userId);
  await db
    .update(agentWallets)
    .set({ balance: sql`${agentWallets.balance} + ${n}`, granted: sql`${agentWallets.granted} + ${n}`, updatedAt: new Date() })
    .where(eq(agentWallets.userId, userId));
}

/* ------------------------------ Quiz lock ------------------------------ */

// සිසුවා Quiz එකක් කරමින් සිටිනවාද (ආරම්භ කර තවම ඉදිරිපත් කර නැත). එසේ නම් Agent උදව් නොකරයි
export async function hasActiveQuiz(userId: string): Promise<boolean> {
  await finalizeExpired({ studentId: userId });
  const [a] = await db
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, userId), isNull(quizAttempts.submittedAt)))
    .limit(1);
  return !!a;
}

/* ------------------------------ Messages ------------------------------ */

export async function loadConversation(userId: string, conversationId: string, limit = AGENT_HISTORY_LIMIT) {
  const rows = await db
    .select({ id: agentMessages.id, role: agentMessages.role, content: agentMessages.content })
    .from(agentMessages)
    .where(and(eq(agentMessages.userId, userId), eq(agentMessages.conversationId, conversationId)))
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

/* ------------------------------ Model call ------------------------------ */

export type ModelMsg = { role: "user" | "assistant"; content: string };

export class AgentUnavailable extends Error {}

// පෙර පණිවිඩ: පළමුවැන්න user විය යුතුය, role මාරුවෙන් මාරුවට විය යුතුය
export function toModelMessages(history: ModelMsg[]): ModelMsg[] {
  const out: ModelMsg[] = [];
  for (const m of history.slice(-AGENT_CONTEXT_MESSAGES)) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export async function askModel(system: string, messages: ModelMsg[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new AgentUnavailable("ANTHROPIC_API_KEY is not configured");
    // Development / tests: API key නොමැතිව UI එක පරීක්ෂා කිරීමට demo පිළිතුරක්
    const last = messages[messages.length - 1]?.content ?? "";
    return demoReply(last);
  }
  const res = await fetch(`${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.AGENT_MODEL || "claude-haiku-5-5",
      max_tokens: 700,
      temperature: 0.5,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    console.error("agent model error", res.status, (await res.text()).slice(0, 300));
    throw new AgentUnavailable(`model status ${res.status}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  if (!text) throw new AgentUnavailable("empty reply");
  return text.slice(0, 4000);
}

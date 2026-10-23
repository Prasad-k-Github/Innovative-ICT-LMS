import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentAttachments, agentMessages, agentWallets, quizAttempts } from "@/db/schema";
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
export async function spendCredit(userId: string, n = 1): Promise<number | null> {
  const [row] = await db
    .update(agentWallets)
    .set({ balance: sql`${agentWallets.balance} - ${n}`, used: sql`${agentWallets.used} + ${n}`, updatedAt: new Date() })
    .where(and(eq(agentWallets.userId, userId), sql`${agentWallets.balance} >= ${n}`))
    .returning({ balance: agentWallets.balance });
  return row ? row.balance : null;
}

export async function refundCredit(userId: string, n = 1) {
  await db
    .update(agentWallets)
    .set({ balance: sql`${agentWallets.balance} + ${n}`, used: sql`GREATEST(${agentWallets.used} - ${n}, 0)`, updatedAt: new Date() })
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

export type ConvFile = { id: string; name: string; mime: string };
export type ConvMessage = { id: string; role: "user" | "assistant"; content: string; files: ConvFile[] };

export async function loadConversation(userId: string, conversationId: string, limit = AGENT_HISTORY_LIMIT): Promise<ConvMessage[]> {
  const rows = await db
    .select({ id: agentMessages.id, role: agentMessages.role, content: agentMessages.content })
    .from(agentMessages)
    .where(and(eq(agentMessages.userId, userId), eq(agentMessages.conversationId, conversationId)))
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit);
  rows.reverse();
  const files = rows.length
    ? await db
        .select({ id: agentAttachments.id, messageId: agentAttachments.messageId, name: agentAttachments.filename, mime: agentAttachments.mime })
        .from(agentAttachments)
        .where(inArray(agentAttachments.messageId, rows.map((r) => r.id)))
        .orderBy(asc(agentAttachments.filename))
    : [];
  return rows.map((r) => ({ ...r, files: files.filter((f) => f.messageId === r.id).map((f) => ({ id: f.id, name: f.name, mime: f.mime })) }));
}

/* ------------------------------ Model call ------------------------------ */

export type ModelBlock =
  | { type: "text"; text: string }
  | { type: "image" | "document"; source: { type: "base64"; media_type: string; data: string } };
export type ModelMsg = { role: "user" | "assistant"; content: string | ModelBlock[] };
export type ModelFile = { mime: string; data: Buffer; filename: string };

export class AgentUnavailable extends Error {}

// පෙර පණිවිඩ: පළමුවැන්න user විය යුතුය, role මාරුවෙන් මාරුවට විය යුතුය
export function toModelMessages(history: ModelMsg[]): ModelMsg[] {
  const out: ModelMsg[] = [];
  for (const m of history.slice(-AGENT_CONTEXT_MESSAGES)) {
    const last = out[out.length - 1];
    if (last && last.role === m.role && typeof last.content === "string" && typeof m.content === "string") last.content += "\n" + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// කුමන AI provider එකද: AI_PROVIDER=anthropic|gemini; නැත්නම් ඇති key එක අනුව (ANTHROPIC_API_KEY පළමුව)
export function aiProvider(): "anthropic" | "gemini" | null {
  const want = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (want === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (want === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

function lastText(messages: ModelMsg[]): string {
  const lastMsg = messages[messages.length - 1]?.content;
  return typeof lastMsg === "string" ? lastMsg : ((lastMsg ?? []).find((b) => b.type === "text") as { text: string } | undefined)?.text ?? "";
}

// ගුරුතුමාගේ සහායකයට දිගු පිළිතුරු (Quiz, සැලසුම්) සඳහා වැඩි output සීමාවක්
export type AskOptions = { long?: boolean };

export async function askModel(system: string, messages: ModelMsg[], files: ModelFile[] = [], opts: AskOptions = {}): Promise<string> {
  const provider = aiProvider();
  if (!provider) {
    if (process.env.NODE_ENV === "production") throw new AgentUnavailable("no AI provider key configured");
    // Development / tests: API key නොමැතිව UI එක පරීක්ෂා කිරීමට demo පිළිතුරක්
    return demoReply(lastText(messages), files.map((f) => f.filename));
  }
  return provider === "gemini" ? askGemini(system, messages, files, opts) : askAnthropic(system, messages, files, opts);
}

/* ------------------------------ Google Gemini ------------------------------ */

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

async function askGemini(system: string, messages: ModelMsg[], files: ModelFile[], opts: AskOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY as string;
  const model = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
  const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : (m.content.find((b) => b.type === "text") as { text: string } | undefined)?.text ?? "" }],
  }));
  // ඇමුණුම් (ඡායාරූප/PDF) අවසන් user පණිවිඩයට පමණක්: ඡායාරූප මුලින්, පසුව ප්‍රශ්නය
  if (files.length && contents.length) {
    const last = contents[contents.length - 1];
    last.parts = [...files.map((f): GeminiPart => ({ inline_data: { mime_type: f.mime, data: f.data.toString("base64") } })), ...last.parts];
  }

  const call = async (withThinking: boolean) =>
    fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      // key එක header එකෙන් (URL එකේ නොවේ: logs වල නොපෙනීමට)
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        // Gemini 3.6+ temperature නොසලකයි. thinking tokens ද output සීමාවට ගණන් ගැනේ: ඉඩ ඉතිරි කරයි
        generationConfig: { maxOutputTokens: opts.long ? 6000 : 1500, ...(withThinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
      }),
      signal: AbortSignal.timeout(opts.long ? 90_000 : files.length ? 70_000 : 45_000),
    });

  let res = await call(true);
  if (res.status === 400) {
    const b = await res.clone().text();
    // සමහර model (උදා: Flash-Lite) thinkingLevel නොපිළිගනී: එය නැතිව නැවත
    if (/thinking/i.test(b)) res = await call(false);
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    console.error("agent model error (gemini)", res.status, body);
    if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(body)) console.error("HINT: GEMINI_API_KEY is not valid. Create a key at https://aistudio.google.com/apikey and put it in .env.local.");
    if (res.status === 404) console.error(`HINT: model "${model}" not found. Set GEMINI_MODEL to an available model (see https://ai.google.dev/gemini-api/docs/pricing).`);
    if (res.status === 429) console.error("HINT: Gemini quota / rate limit reached (free tier is limited). Wait a minute, use another GEMINI_MODEL, or enable billing in Google AI Studio.");
    if (res.status === 403) console.error("HINT: Gemini key is not allowed to use this API/model (check the key's project/restrictions).");
    throw new AgentUnavailable(`gemini status ${res.status}`);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; promptFeedback?: { blockReason?: string } };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    if (data.promptFeedback?.blockReason) console.error("gemini blocked the prompt:", data.promptFeedback.blockReason);
    throw new AgentUnavailable("empty reply");
  }
  return text.slice(0, opts.long ? 12_000 : 4000);
}

/* ------------------------------ Anthropic ------------------------------ */

async function askAnthropic(system: string, messages: ModelMsg[], files: ModelFile[], opts: AskOptions): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY as string;
  // ඇමුණුම් අවසන් user පණිවිඩයට පමණක් ඇතුළත් කරයි (ඡායාරූප/PDF මුලින්, පසුව ප්‍රශ්නය)
  let payload = messages;
  if (files.length) {
    const lastMsg = messages[messages.length - 1];
    const text = typeof lastMsg.content === "string" ? lastMsg.content : "";
    const blocks: ModelBlock[] = files.map((f) => ({
      type: f.mime === "application/pdf" ? "document" : "image",
      source: { type: "base64", media_type: f.mime, data: f.data.toString("base64") },
    }));
    payload = [...messages.slice(0, -1), { role: "user", content: [...blocks, { type: "text", text }] }];
  }
  const res = await fetch(`${(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // Workspace එකකට scope නොවූ API key සඳහා (ANTHROPIC_WORKSPACE_ID); scope වූ key එකකට අවශ්‍ය නැත
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID.trim() } : {}),
    },
    body: JSON.stringify({
      model: process.env.AGENT_MODEL || "claude-haiku-5-5",
      max_tokens: opts.long ? 3500 : 700,
      temperature: 0.5,
      system,
      messages: payload,
    }),
    signal: AbortSignal.timeout(opts.long ? 90_000 : files.length ? 70_000 : 45_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    console.error("agent model error", res.status, body);
    if (/workspace/i.test(body) && !process.env.ANTHROPIC_WORKSPACE_ID) {
      console.error("HINT: set ANTHROPIC_WORKSPACE_ID in .env.local (Anthropic Console → Settings → Workspaces → ID), or create an API key inside a specific workspace.");
    }
    if (/credit balance/i.test(body)) {
      console.error("HINT: your Anthropic API account has no credit. Add credits at Anthropic Console → Settings → Billing (Plans & Billing); the chat works again right after.");
    }
    throw new AgentUnavailable(`model status ${res.status}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  if (!text) throw new AgentUnavailable("empty reply");
  return text.slice(0, opts.long ? 12_000 : 4000);
}

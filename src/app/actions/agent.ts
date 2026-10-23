"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { agentAttachments, agentMessages, agentWallets, users } from "@/db/schema";
import { AGENT_ADMIN_MAX_CHARS, AGENT_FILE_COST, AGENT_MAX_CHARS, AGENT_MAX_GRANT, ASSISTANT_PATH } from "@/lib/agent-config";
import { AgentUnavailable, addCredits, aiProvider, askModel, ensureWallet, hasActiveQuiz, loadConversation, refundCredit, spendCredit, toModelMessages } from "@/lib/agent";
import { readUploads } from "@/lib/agent-files";
import { buildSystemPrompt, buildTeacherPrompt } from "@/lib/agent-prompt";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin, requireStudent } from "@/lib/session";

// සටහන: සෑම action එකක්ම පළමුව requireStudent()/requireAdmin() මගින් භූමිකාව පරීක්ෂා කරයි. User id එක සෑම විටම session එකෙන් ගනී.

export type AgentReply = {
  ok?: boolean;
  reply?: string;
  balance?: number;
  error?: string;
  locked?: "quiz" | "credits" | "unavailable";
};

const fail = async (error: string, extra: Partial<AgentReply> = {}): Promise<AgentReply> => {
  const t = await getT();
  return { error: t(error), ...extra };
};

export async function sendAgentMessageAction(formData: FormData): Promise<AgentReply> {
  const me = await requireStudent();
  const rawText = formData.get("text");
  const text = (typeof rawText === "string" ? rawText : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (text.length > AGENT_MAX_CHARS) return fail("පණිවිඩය දිගයි. කෙටි කර නැවත යවන්න.");
  if (!(await rateLimit(`agent:${me.id}`, 10, 60_000))) return fail("ටිකක් ඉන්න! මිනිත්තුවකට පණිවිඩ 10කට වඩා යැවිය නොහැක.");

  // Quiz එකක් කරමින් සිටින විට Agent උදව් නොකරයි (ඡායාරූප/PDF ඇතුළුව; server එකේම බලාත්මක කරයි)
  if (await hasActiveQuiz(me.id)) return fail("Quiz එකක් කරමින් සිටින නිසා ICT මිතුරා දැන් උදව් කරන්නේ නැත.", { locked: "quiz" });

  const up = await readUploads(formData);
  if ("error" in up) return fail(up.error);
  const uploads = up.files;
  if (!text && uploads.length === 0) return fail("පණිවිඩයක් ලියන්න.");

  const cost = uploads.length ? AGENT_FILE_COST : 1;
  const wallet = await ensureWallet(me.id);
  const balance = await spendCredit(me.id, cost);
  if (balance === null) {
    const left = (await ensureWallet(me.id)).balance;
    return fail(left > 0 ? "ගොනු සහිත පණිවිඩයකට credits 2ක් අවශ්‍යයි." : "ඔබේ credits අවසන් වී ඇත.", { locked: left > 0 ? undefined : "credits", balance: left });
  }

  try {
    const [system, history] = await Promise.all([buildSystemPrompt(me), loadConversation(me.id, wallet.conversationId, 12)]);
    const past = history.map((m) => {
      const names = m.files.map((f) => f.name).join(", ");
      const content = [m.content, names ? `[attached: ${names}]` : ""].filter(Boolean).join("\n") || "(empty)";
      return { role: m.role, content };
    });
    const asked = text || "Please look at the attached file(s) and help me understand the ICT part.";
    const messages = toModelMessages([...past, { role: "user", content: asked }]);
    const reply = await askModel(system, messages, uploads);
    const now = Date.now();
    const [userRow] = await db
      .insert(agentMessages)
      .values({ userId: me.id, conversationId: wallet.conversationId, role: "user", content: text, createdAt: new Date(now) })
      .returning({ id: agentMessages.id });
    await db.insert(agentMessages).values({ userId: me.id, conversationId: wallet.conversationId, role: "assistant", content: reply, createdAt: new Date(now + 1) });
    if (uploads.length) {
      await db.insert(agentAttachments).values(uploads.map((u) => ({ messageId: userRow.id, userId: me.id, filename: u.filename, mime: u.mime, size: u.size, data: u.data })));
    }
    return { ok: true, reply, balance };
  } catch (e) {
    await refundCredit(me.id, cost); // අසාර්ථක වූ විට credits ආපසු දෙයි
    if (!(e instanceof AgentUnavailable)) console.error("agent failed", e);
    return fail("ICT මිතුරාට දැන් පිළිතුරු දීමට නොහැකි විය. ටික වේලාවකින් නැවත උත්සාහ කරන්න (ඔබේ credits අඩු වී නැත).", {
      locked: e instanceof AgentUnavailable && process.env.NODE_ENV === "production" && !aiProvider() ? "unavailable" : undefined,
    });
  }
}

export async function newAgentChatAction(): Promise<{ ok: true }> {
  const me = await requireStudent();
  await ensureWallet(me.id);
  await db.update(agentWallets).set({ conversationId: randomUUID() }).where(eq(agentWallets.userId, me.id));
  revalidatePath("/dashboard/agent");
  return { ok: true };
}

/* -------------------- ගුරුතුමාගේ AI සහායකයා (Admin) -------------------- */
// Credits නැත, Quiz අගුල නැත. සිසුන්ගේ ICT මිතුරාට වෙනම prompt එකක් සහ දිගු පිළිතුරු.

export async function sendAssistantMessageAction(formData: FormData): Promise<AgentReply> {
  const me = await requireAdmin();
  const rawText = formData.get("text");
  const text = (typeof rawText === "string" ? rawText : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (text.length > AGENT_ADMIN_MAX_CHARS) return fail("පණිවිඩය දිගයි. කෙටි කර නැවත යවන්න.");
  if (!(await rateLimit(`assistant:${me.id}`, 20, 60_000))) return fail("ටිකක් ඉන්න! මිනිත්තුවකට පණිවිඩ 20කට වඩා යැවිය නොහැක.");

  const up = await readUploads(formData);
  if ("error" in up) return fail(up.error);
  const uploads = up.files;
  if (!text && uploads.length === 0) return fail("පණිවිඩයක් ලියන්න.");

  try {
    const wallet = await ensureWallet(me.id);
    const [system, history] = await Promise.all([buildTeacherPrompt(me), loadConversation(me.id, wallet.conversationId, 12)]);
    const past = history.map((m) => {
      const names = m.files.map((f) => f.name).join(", ");
      const content = [m.content, names ? `[attached: ${names}]` : ""].filter(Boolean).join("\n") || "(empty)";
      return { role: m.role, content };
    });
    const asked = text || "Please look at the attached file(s) and help me with them.";
    const messages = toModelMessages([...past, { role: "user", content: asked }]);
    const reply = await askModel(system, messages, uploads, { long: true });
    const now = Date.now();
    const [userRow] = await db
      .insert(agentMessages)
      .values({ userId: me.id, conversationId: wallet.conversationId, role: "user", content: text, createdAt: new Date(now) })
      .returning({ id: agentMessages.id });
    await db.insert(agentMessages).values({ userId: me.id, conversationId: wallet.conversationId, role: "assistant", content: reply, createdAt: new Date(now + 1) });
    if (uploads.length) {
      await db.insert(agentAttachments).values(uploads.map((u) => ({ messageId: userRow.id, userId: me.id, filename: u.filename, mime: u.mime, size: u.size, data: u.data })));
    }
    return { ok: true, reply };
  } catch (e) {
    if (!(e instanceof AgentUnavailable)) console.error("assistant failed", e);
    return fail("AI සහායකයාට දැන් පිළිතුරු දීමට නොහැකි විය. ටික වේලාවකින් නැවත උත්සාහ කරන්න.", {
      locked: e instanceof AgentUnavailable && process.env.NODE_ENV === "production" && !aiProvider() ? "unavailable" : undefined,
    });
  }
}

export async function newAssistantChatAction(): Promise<{ ok: true }> {
  const me = await requireAdmin();
  await ensureWallet(me.id);
  await db.update(agentWallets).set({ conversationId: randomUUID() }).where(eq(agentWallets.userId, me.id));
  revalidatePath(ASSISTANT_PATH);
  return { ok: true };
}

/* ------------------------------ Admin ------------------------------ */

const back = (path: string, key: string, value: string): never => {
  const url = new URL(path, "http://local");
  url.searchParams.set(key, value);
  redirect(url.pathname + url.search);
};

const GRANT_RANGE_ERROR = "Credits ගණන 1 - 500 අතර පූර්ණ සංඛ්‍යාවක් විය යුතුය";

function parseAmount(raw: FormDataEntryValue | null) {
  const n = Number(raw?.toString() ?? "");
  return Number.isInteger(n) && n >= 1 && n <= AGENT_MAX_GRANT ? n : null;
}

export async function grantAgentCreditsAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("studentId")?.toString() ?? "";
  const n = parseAmount(formData.get("amount"));
  const base = "/admin/agent";
  if (!UUID_RE.test(id)) back(base, "error", "සිසුවා හමු නොවීය");
  if (n === null) back(base, "error", GRANT_RANGE_ERROR);
  const [stu] = await db.select({ id: users.id, email: users.email }).from(users).where(and(eq(users.id, id), eq(users.role, "STUDENT"))).limit(1);
  if (!stu) back(base, "error", "සිසුවා හමු නොවීය");
  await addCredits(stu!.id, n!);
  await audit(admin.id, "agent.grant", stu!.email, `+${n} credits`, stu!.id);
  back(base, "notice", "granted");
}

export async function grantAllAgentCreditsAction(formData: FormData) {
  const admin = await requireAdmin();
  const n = parseAmount(formData.get("amount"));
  const base = "/admin/agent";
  if (n === null) back(base, "error", GRANT_RANGE_ERROR);
  const students = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "STUDENT"), eq(users.status, "ACTIVE")));
  for (const s of students) await addCredits(s.id, n!);
  await audit(admin.id, "agent.grant_all", `${students.length}`, `+${n} credits each`);
  back(base, "notice", "granted_all");
}

"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, communityMutes, communityReports, forumPosts, forumThreads, users } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { CHAT_KEEP_DAYS, CHAT_MAX, CONTACT_INFO_ERROR, MUTED_ERROR, canAccessRoom, containsContactInfo, isRoom } from "@/lib/community";
import { activeMute } from "@/lib/community-data";
import { localized, getT } from "@/lib/i18n/server";
import { notifyAdmins, notifyUsers } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { isAdminRole, requireAdmin, requireUser } from "@/lib/session";
import { replySchema, threadSchema, valuesFrom, type FormState } from "@/lib/validators";

// සංවාද මණ්ඩපය (Forum + Live chat). සිසුන්ට: තමන්ගේ ශ්‍රේණි කාමරය සහ පොදු කාමරය පමණි; link/email/දුරකථන අංක තහනම්;
// Admin ට: සැඟවීම, මැකීම, ලොක් කිරීම, සවි කිරීම, mute කිරීම. සෑම action එකක්ම භූමිකාව පරීක්ෂා කරයි.

type Me = Awaited<ReturnType<typeof requireUser>>;

const baseOf = (u: Me) => (isAdminRole(u.role) ? "/admin/community" : "/dashboard/community");

// ආපසු යන URL: සංවාද මණ්ඩපයේ පිටුවක් පමණි (open redirect වැළැක්වීමට)
function safeBack(v: FormDataEntryValue | null, fallback: string) {
  const s = typeof v === "string" ? v : "";
  return /^\/(dashboard|admin)\/community(\/[\w-]+)*(\?[\w=&%.-]*)?$/.test(s) ? s : fallback;
}
const withNotice = (url: string, notice: string) => `${url}${url.includes("?") ? "&" : "?"}notice=${notice}`;

// පළ කිරීමට පෙර: mute කර ඇත්ද, link/දුරකථන අංක තිබේද (සිසුන්ට පමණි)
async function postingProblem(u: Me, text: string): Promise<string | null> {
  if (isAdminRole(u.role)) return null;
  if (await activeMute(u.id)) return MUTED_ERROR;
  if (containsContactInfo(text)) return CONTACT_INFO_ERROR;
  return null;
}

/* ----------------------------------- Forum ----------------------------------- */

async function createThreadImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const values = valuesFrom(formData);
  const parsed = threadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values };
  const d = parsed.data;
  if (!canAccessRoom(me, d.room)) return { error: "මෙම කාමරයට ඔබට ප්‍රවේශය නැත.", values };
  const problem = await postingProblem(me, `${d.title}\n${d.body}`);
  if (problem) return { error: problem, values };
  if (!(await rateLimit(`thread:${me.id}`, 5, 60 * 60_000))) return { error: "ඔබ මාතෘකා ගොඩක් සෑදුවා. පැයකින් පසු නැවත උත්සාහ කරන්න.", values };
  const [row] = await db.insert(forumThreads).values({ room: d.room, authorId: me.id, title: d.title, body: d.body }).returning({ id: forumThreads.id });
  redirect(withNotice(`${baseOf(me)}/${row.id}`, "created"));
}

export async function createThreadAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await createThreadImpl(prev, formData));
}

async function replyImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const values = valuesFrom(formData);
  const threadId = formData.get("threadId")?.toString() ?? "";
  if (!UUID_RE.test(threadId)) redirect(baseOf(me));
  const parsed = replySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values };
  const [th] = await db
    .select({ id: forumThreads.id, room: forumThreads.room, title: forumThreads.title, locked: forumThreads.locked, hidden: forumThreads.hidden, authorId: forumThreads.authorId, authorRole: users.role })
    .from(forumThreads)
    .innerJoin(users, eq(users.id, forumThreads.authorId))
    .where(eq(forumThreads.id, threadId))
    .limit(1);
  const staff = isAdminRole(me.role);
  if (!th || !canAccessRoom(me, th.room) || (th.hidden && !staff)) redirect(baseOf(me));
  if (th.locked && !staff) return { error: "මෙම මාතෘකාව ලොක් කර ඇත. පිළිතුරු යැවිය නොහැක.", values };
  const problem = await postingProblem(me, parsed.data.body);
  if (problem) return { error: problem, values };
  if (!(await rateLimit(`reply:${me.id}`, 20, 10 * 60_000))) return { error: "ඔබ පිළිතුරු ගොඩක් යැවුවා. මඳ වේලාවකින් නැවත උත්සාහ කරන්න.", values };
  await db.insert(forumPosts).values({ threadId, authorId: me.id, body: parsed.data.body });
  await db
    .update(forumThreads)
    .set({ replyCount: sql`(select count(*)::int from forum_posts where thread_id = ${threadId} and hidden = false)`, lastActivityAt: new Date() })
    .where(eq(forumThreads.id, threadId));
  if (th.authorId !== me.id) await notifyUsers([th.authorId], "COMMUNITY_REPLY", { id: threadId, title: th.title.slice(0, 120), admin: isAdminRole(th.authorRole as Me["role"]) ? 1 : 0 });
  redirect(withNotice(`${baseOf(me)}/${threadId}`, "posted"));
}

export async function replyAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await replyImpl(prev, formData));
}

/* ------------------------------ Report (වාර්තා කිරීම) ------------------------------ */

export async function reportAction(formData: FormData) {
  const me = await requireUser();
  const back = safeBack(formData.get("back"), baseOf(me));
  const kind = formData.get("kind")?.toString() ?? "";
  const id = formData.get("id")?.toString() ?? "";
  if (!["THREAD", "POST", "CHAT"].includes(kind) || !UUID_RE.test(id)) redirect(back);
  let room: string | undefined;
  if (kind === "THREAD") room = (await db.select({ room: forumThreads.room }).from(forumThreads).where(eq(forumThreads.id, id)).limit(1))[0]?.room;
  else if (kind === "CHAT") room = (await db.select({ room: chatMessages.room }).from(chatMessages).where(eq(chatMessages.id, id)).limit(1))[0]?.room;
  else
    room = (
      await db
        .select({ room: forumThreads.room })
        .from(forumPosts)
        .innerJoin(forumThreads, eq(forumThreads.id, forumPosts.threadId))
        .where(eq(forumPosts.id, id))
        .limit(1)
    )[0]?.room;
  if (!room || !canAccessRoom(me, room)) redirect(back);
  if (!(await rateLimit(`report:${me.id}`, 10, 60 * 60_000))) redirect(withNotice(back, "toomany"));
  const reason = (formData.get("reason")?.toString() ?? "").trim().slice(0, 200);
  const ins = await db.insert(communityReports).values({ kind, targetId: id, reporterId: me.id, reason }).onConflictDoNothing().returning({ id: communityReports.id });
  if (ins[0]) await notifyAdmins("COMMUNITY_REPORT", { room }, me.id);
  redirect(withNotice(back, "reported"));
}

/* ------------------------------------ Live chat ------------------------------------ */

export type ChatSendResult = { ok: boolean; error?: string };

export async function sendChatMessageAction(room: string, body: string): Promise<ChatSendResult> {
  const me = await requireUser();
  const t = await getT();
  const text = String(body ?? "").trim();
  if (!isRoom(room) || !canAccessRoom(me, room)) return { ok: false, error: t("මෙම කාමරයට ඔබට ප්‍රවේශය නැත.") };
  if (text.length < 1) return { ok: false, error: t("පණිවිඩය හිස්ය.") };
  if (text.length > CHAT_MAX) return { ok: false, error: t("පණිවිඩය දිග වැඩියි (උපරිම අක්ෂර {n}).", { n: CHAT_MAX }) };
  const problem = await postingProblem(me, text);
  if (problem) return { ok: false, error: t(problem) };
  if (!(await rateLimit(`chat:${me.id}`, 12, 30_000))) return { ok: false, error: t("ඔබ ඉතා වේගයෙන් පණිවිඩ යවනවා. තත්පර කිහිපයකින් නැවත උත්සාහ කරන්න.") };
  await db.insert(chatMessages).values({ room, authorId: me.id, body: text });
  // පරණ පණිවිඩ ඉඳහිට ඉවත් කරයි
  if (Math.random() < 0.02) await db.delete(chatMessages).where(sql`created_at < now() - make_interval(days => ${CHAT_KEEP_DAYS})`);
  return { ok: true };
}

/* ------------------------------ Admin: පාලනය (moderation) ------------------------------ */

const FLAGS = {
  hidden: ["community.thread.show", "community.thread.hide"],
  locked: ["community.thread.unlock", "community.thread.lock"],
  pinned: ["community.thread.unpin", "community.thread.pin"],
} as const;

export async function setThreadFlagAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = safeBack(formData.get("back"), "/admin/community");
  const id = formData.get("id")?.toString() ?? "";
  const flag = formData.get("flag")?.toString() ?? "";
  if (!UUID_RE.test(id) || !(flag in FLAGS)) redirect(back);
  const on = formData.get("value") === "1";
  const rows = await db.update(forumThreads).set({ [flag]: on }).where(eq(forumThreads.id, id)).returning({ title: forumThreads.title });
  if (rows[0]) await audit(admin.id, FLAGS[flag as keyof typeof FLAGS][on ? 1 : 0], rows[0].title.slice(0, 100), undefined, id);
  redirect(withNotice(back, "done"));
}

export async function deleteThreadAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/community");
  const rows = await db.delete(forumThreads).where(eq(forumThreads.id, id)).returning({ title: forumThreads.title, room: forumThreads.room });
  if (rows[0]) {
    await audit(admin.id, "community.thread.delete", rows[0].title.slice(0, 100), undefined, id);
    await db.delete(communityReports).where(and(eq(communityReports.kind, "THREAD"), eq(communityReports.targetId, id)));
  }
  redirect(withNotice(`/admin/community${rows[0] ? `?room=${rows[0].room}` : ""}`, "deleted"));
}

async function recount(threadId: string) {
  await db
    .update(forumThreads)
    .set({ replyCount: sql`(select count(*)::int from forum_posts where thread_id = ${threadId} and hidden = false)` })
    .where(eq(forumThreads.id, threadId));
}

export async function setPostHiddenAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = safeBack(formData.get("back"), "/admin/community");
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect(back);
  const hide = formData.get("value") === "1";
  const rows = await db.update(forumPosts).set({ hidden: hide }).where(eq(forumPosts.id, id)).returning({ threadId: forumPosts.threadId });
  if (rows[0]) {
    await recount(rows[0].threadId);
    await audit(admin.id, hide ? "community.post.hide" : "community.post.show", id.slice(0, 8), undefined, id);
  }
  redirect(withNotice(back, "done"));
}

export async function deletePostAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = safeBack(formData.get("back"), "/admin/community");
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect(back);
  const rows = await db.delete(forumPosts).where(eq(forumPosts.id, id)).returning({ threadId: forumPosts.threadId });
  if (rows[0]) {
    await recount(rows[0].threadId);
    await db.delete(communityReports).where(and(eq(communityReports.kind, "POST"), eq(communityReports.targetId, id)));
    await audit(admin.id, "community.post.delete", id.slice(0, 8), undefined, id);
  }
  redirect(withNotice(back, "done"));
}

export async function setChatHiddenAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = safeBack(formData.get("back"), "/admin/community/chat");
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect(back);
  const hide = formData.get("value") === "1";
  const rows = await db.update(chatMessages).set({ hidden: hide }).where(eq(chatMessages.id, id)).returning({ id: chatMessages.id });
  if (rows[0] && hide) await audit(admin.id, "community.chat.hide", id.slice(0, 8), undefined, id);
  redirect(withNotice(back, "done"));
}

const MUTE_MS: Record<string, number | null> = { "1d": 86_400_000, "7d": 7 * 86_400_000, forever: null };

export async function muteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = safeBack(formData.get("back"), "/admin/community/reports");
  const userId = formData.get("userId")?.toString() ?? "";
  const dur = formData.get("duration")?.toString() ?? "1d";
  if (!UUID_RE.test(userId) || !(dur in MUTE_MS)) redirect(back);
  const [target] = await db.select({ name: users.name, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role !== "STUDENT") redirect(back); // Admin ලා mute කළ නොහැක
  const ms = MUTE_MS[dur];
  const until = ms === null ? null : new Date(Date.now() + ms);
  const reason = (formData.get("reason")?.toString() ?? "").trim().slice(0, 200);
  await db
    .insert(communityMutes)
    .values({ userId, mutedBy: admin.id, reason, until })
    .onConflictDoUpdate({ target: communityMutes.userId, set: { mutedBy: admin.id, reason, until, createdAt: new Date() } });
  await audit(admin.id, "community.mute", target.name.slice(0, 100), dur, userId);
  redirect(withNotice(back, "muted"));
}

export async function unmuteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = safeBack(formData.get("back"), "/admin/community/reports");
  const userId = formData.get("userId")?.toString() ?? "";
  if (!UUID_RE.test(userId)) redirect(back);
  const rows = await db.delete(communityMutes).where(eq(communityMutes.userId, userId)).returning({ userId: communityMutes.userId });
  if (rows[0]) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    await audit(admin.id, "community.unmute", (u?.name ?? "").slice(0, 100), undefined, userId);
  }
  redirect(withNotice(back, "unmuted"));
}

// වාර්තාවක් නිරාකරණය කරයි; hide=1 නම් අදාළ අන්තර්ගතයද සඟවයි
export async function resolveReportAction(formData: FormData) {
  const admin = await requireAdmin();
  const back = "/admin/community/reports";
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect(back);
  const [rep] = await db.select().from(communityReports).where(eq(communityReports.id, id)).limit(1);
  if (!rep) redirect(back);
  if (formData.get("hide") === "1") {
    if (rep.kind === "THREAD") await db.update(forumThreads).set({ hidden: true }).where(eq(forumThreads.id, rep.targetId));
    else if (rep.kind === "CHAT") await db.update(chatMessages).set({ hidden: true }).where(eq(chatMessages.id, rep.targetId));
    else {
      const r = await db.update(forumPosts).set({ hidden: true }).where(eq(forumPosts.id, rep.targetId)).returning({ threadId: forumPosts.threadId });
      if (r[0]) await recount(r[0].threadId);
    }
  }
  // එකම අන්තර්ගතය පිළිබඳ සියලු වාර්තා නිරාකරණය වේ
  await db
    .update(communityReports)
    .set({ status: "DONE", handledBy: admin.id })
    .where(and(eq(communityReports.kind, rep.kind), eq(communityReports.targetId, rep.targetId)));
  await audit(admin.id, "community.report.done", `${rep.kind}:${rep.targetId.slice(0, 8)}`, formData.get("hide") === "1" ? "hidden" : undefined, rep.targetId);
  redirect(withNotice(back, "done"));
}

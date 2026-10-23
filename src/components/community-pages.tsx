import Link from "next/link";
import type { ReactNode } from "react";
import { createThreadAction, deletePostAction, deleteThreadAction, muteUserAction, replyAction, reportAction, resolveReportAction, setPostHiddenAction, setThreadFlagAction, unmuteUserAction } from "@/app/actions/community";
import { Avatar, Chip } from "@/components/cards";
import { ChatRoom, type ChatMsg } from "@/components/chat-room";
import { ReplyForm, ThreadForm } from "@/components/community-forms";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHero, PageTabs, listCard } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { chatMessages, communityMutes, communityReports, forumPosts, forumThreads, users } from "@/db/schema";
import { count, desc, eq, inArray } from "drizzle-orm";
import { CHAT_MAX, GENERAL_ROOM, canAccessRoom, isRoom, roomLabel, roomOfGrade, roomsFor } from "@/lib/community";
import { activeMute, authorOf, getThread, listPosts, listThreads, nowMs, recentChat } from "@/lib/community-data";
import { getT } from "@/lib/i18n/server";
import type { requireUser } from "@/lib/session";
import { formatColombo } from "@/lib/time";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/assessment";

type User = Awaited<ReturnType<typeof requireUser>>;
type SP = Record<string, string | string[] | undefined>;
type Ctx = { user: User; base: string; isAdmin: boolean; sp: SP };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const NOTICES: Record<string, [string, "success" | "warning"]> = {
  created: ["මාතෘකාව පළ කරන ලදී.", "success"],
  posted: ["ඔබේ පිළිතුර පළ කරන ලදී.", "success"],
  reported: ["වාර්තා කළාට ස්තූතියි. ගුරුතුමා මෙය පරීක්ෂා කරනු ඇත.", "success"],
  toomany: ["ඔබ වාර්තා ගොඩක් යවා ඇත. පසුව නැවත උත්සාහ කරන්න.", "warning"],
  done: ["සුරකින ලදී.", "success"],
  deleted: ["මකා දමන ලදී.", "success"],
  muted: ["සිසුවාට පණිවිඩ යැවීම නවත්වන ලදී.", "success"],
  unmuted: ["සිසුවාට නැවත පණිවිඩ යැවිය හැක.", "success"],
};

function NoticeBar({ sp, t }: { sp: SP; t: (k: string) => string }) {
  const n = NOTICES[one(sp.notice) ?? ""];
  return n ? <Alert kind={n[1]}>{t(n[0])}</Alert> : null;
}

async function Shell({ ctx, tab, reports, subtitle, children }: { ctx: Ctx; tab: string; reports?: number; subtitle?: string; children: ReactNode }) {
  const t = await getT();
  const tabs = [
    { key: "forum", label: t("Forum (මාතෘකා)"), href: ctx.base },
    { key: "chat", label: t("Live chat"), href: `${ctx.base}/chat` },
    ...(ctx.isAdmin ? [{ key: "reports", label: t("වාර්තා සහ පාලනය"), href: `${ctx.base}/reports`, count: reports && reports > 0 ? reports : undefined, danger: !!reports }] : []),
  ];
  return (
    <div className="w-full space-y-5">
      <PageHero icon="chat" title={t("සංවාද මණ්ඩපය")} subtitle={subtitle ?? t("ICT ගැන ප්‍රශ්න අසන්න, පිළිතුරු දෙන්න, මිතුරන් සමඟ සංවාද කරන්න. සැමට ගරු කරමු.")} />
      <PageTabs tabs={tabs} active={tab} label={t("සංවාද මණ්ඩපය")} />
      <NoticeBar sp={ctx.sp} t={t} />
      {children}
    </div>
  );
}

async function openReports() {
  const [r] = await db.select({ n: count() }).from(communityReports).where(eq(communityReports.status, "OPEN"));
  return r?.n ?? 0;
}

function RoomPicker({ rooms, active, hrefFor, t }: { rooms: string[]; active: string; hrefFor: (r: string) => string; t: (k: string) => string }) {
  return (
    <nav aria-label={t("කාමරය")} className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {rooms.map((r) => (
          <li key={r}>
            <Link
              href={hrefFor(r)}
              data-room={r}
              aria-current={r === active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${r === active ? "border-primary bg-primary text-white" : "border-line bg-white text-muted hover:border-primary/50 hover:text-primary"}`}
            >
              {roomLabel(r, t as never)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function pickRoom(ctx: Ctx) {
  const rooms = roomsFor(ctx.user);
  const q = one(ctx.sp.room);
  const def = ctx.isAdmin ? GENERAL_ROOM : roomOfGrade(ctx.user.grade);
  const room = q && isRoom(q) && canAccessRoom(ctx.user, q) ? q : def;
  return { rooms, room };
}

function Author({ a, t, when }: { a: ReturnType<typeof authorOf>; t: (k: string) => string; when?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={a.name} size="sm" />
      <p className="min-w-0 text-sm leading-tight">
        <strong className="text-ink">{a.name}</strong>
        {a.staff && <span className="ml-2 rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-navy">{t("ගුරුතුමා")}</span>}
        <span className="block text-xs text-muted">{[a.sub, when].filter(Boolean).join(" · ")}</span>
      </p>
    </div>
  );
}

/* ----------------------------------- Forum: ලැයිස්තුව ----------------------------------- */

export async function ForumIndex(ctx: Ctx) {
  const t = await getT();
  const { rooms, room } = pickRoom(ctx);
  const [threads, reports, mute] = await Promise.all([listThreads(room, ctx.isAdmin), ctx.isAdmin ? openReports() : Promise.resolve(0), ctx.isAdmin ? null : activeMute(ctx.user.id)]);
  return (
    <Shell ctx={ctx} tab="forum" reports={reports}>
      <RoomPicker rooms={rooms} active={room} hrefFor={(r) => `${ctx.base}?room=${r}`} t={t} />
      <details className="card p-4 sm:p-5" data-testid="new-thread" open={one(ctx.sp.new) === "1"}>
        <summary className="flex min-h-11 cursor-pointer items-center font-display text-base font-bold text-navy">{t("+ අලුත් මාතෘකාවක් අරඹන්න")}</summary>
        <div className="mt-4">
          {mute ? <Alert kind="warning">{t("ගුරුතුමා විසින් ඔබට දැනට පණිවිඩ යැවීම නවත්වා ඇත.")}</Alert> : <ThreadForm action={createThreadAction} room={room} />}
        </div>
      </details>
      {threads.length === 0 ? (
        <EmptyState icon="chat">{t("මෙම කාමරයේ තවම මාතෘකා නැත. පළමු ප්‍රශ්නය ඔබෙන් ආරම්භ වේවා!")}</EmptyState>
      ) : (
        <ul className="grid gap-3" data-testid="thread-list">
          {threads.map((th) => {
            const a = authorOf(th, t);
            return (
              <li key={th.id} data-thread={th.id} data-hidden={th.hidden ? "1" : "0"}>
                <Link href={`${ctx.base}/${th.id}`} className={`${listCard} ${th.hidden ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {th.pinned && <Chip tone="sun">📌 {t("සවි කළ")}</Chip>}
                    {th.locked && <Chip tone="red">🔒 {t("ලොක් කළ")}</Chip>}
                    {th.hidden && <Chip tone="violet">{t("සැඟවූ")}</Chip>}
                  </div>
                  <h2 className="mt-1 font-display text-base font-bold text-navy [overflow-wrap:anywhere]">{th.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <Author a={a} t={t} when={formatColombo(th.createdAt)} />
                    <Chip tone="blue" icon="chat">
                      {t("පිළිතුරු {n}", { n: th.replyCount })}
                    </Chip>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

/* ----------------------------------- Forum: මාතෘකාව ----------------------------------- */

function ModForm({ action, fields, children, confirm, testid }: { action: (fd: FormData) => void | Promise<void>; fields: Record<string, string>; children: ReactNode; confirm?: string; testid?: string }) {
  return (
    <form action={confirm ? undefined : action} className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {confirm ? (
        <ConfirmButton message={confirm} formAction={action} className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50" >
          {children}
        </ConfirmButton>
      ) : (
        <button type="submit" data-testid={testid} className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-navy hover:bg-primary-soft">
          {children}
        </button>
      )}
    </form>
  );
}

function MuteBox({ userId, back, t }: { userId: string; back: string; t: (k: string) => string }) {
  return (
    <details className="inline-block align-top">
      <summary className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-amber-800 hover:bg-sun-soft" data-testid="mute-open">
        {t("Mute කරන්න")}
      </summary>
      <form action={muteUserAction} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="back" value={back} />
        <select name="duration" aria-label={t("කාලය")} className="min-h-10 rounded-lg border border-line bg-white px-2 text-sm">
          <option value="1d">{t("දවසක්")}</option>
          <option value="7d">{t("සතියක්")}</option>
          <option value="forever">{t("ස්ථිරව")}</option>
        </select>
        <input name="reason" maxLength={200} placeholder={t("හේතුව (විකල්ප)")} aria-label={t("හේතුව")} className="min-h-10 flex-1 rounded-lg border border-line px-3 text-sm" />
        <button type="submit" data-testid="mute-submit" className="min-h-10 rounded-lg bg-accent px-4 text-sm font-bold text-white">
          {t("Mute")}
        </button>
      </form>
    </details>
  );
}

export async function ThreadPage(ctx: Ctx, id: string) {
  const t = await getT();
  if (!UUID_RE.test(id)) notFound();
  const row = await getThread(id);
  if (!row || !canAccessRoom(ctx.user, row.thread.room) || (row.thread.hidden && !ctx.isAdmin)) notFound();
  const th = row.thread;
  const [posts, reports, mute] = await Promise.all([listPosts(id, ctx.isAdmin), ctx.isAdmin ? openReports() : Promise.resolve(0), ctx.isAdmin ? null : activeMute(ctx.user.id)]);
  const back = `${ctx.base}/${id}`;
  const a = authorOf(row, t);
  const authorIsStudent = row.aRole === "STUDENT";
  return (
    <Shell ctx={ctx} tab="forum" reports={reports}>
      <Link href={`${ctx.base}?room=${th.room}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary">
        ← {roomLabel(th.room, t as never)}
      </Link>
      <article className="card p-4 sm:p-6" data-testid="thread" data-thread={th.id}>
        <div className="flex flex-wrap items-center gap-2">
          {th.pinned && <Chip tone="sun">📌 {t("සවි කළ")}</Chip>}
          {th.locked && <Chip tone="red">🔒 {t("ලොක් කළ")}</Chip>}
          {th.hidden && <Chip tone="violet">{t("සැඟවූ")}</Chip>}
        </div>
        <h2 className="mt-1 font-display text-xl font-bold text-navy [overflow-wrap:anywhere]">{th.title}</h2>
        <div className="mt-3">
          <Author a={a} t={t} when={formatColombo(th.createdAt)} />
        </div>
        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">{th.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!ctx.isAdmin && row.authorId !== ctx.user.id && (
            <ModForm action={reportAction} fields={{ kind: "THREAD", id: th.id, back }} confirm={t("මෙය ගුරුතුමාට වාර්තා කරන්නද?")}>
              {t("වාර්තා කරන්න")}
            </ModForm>
          )}
          {ctx.isAdmin && (
            <>
              <ModForm action={setThreadFlagAction} fields={{ id: th.id, flag: "hidden", value: th.hidden ? "0" : "1", back }} testid="thread-hide">{th.hidden ? t("නැවත පෙන්වන්න") : t("සඟවන්න")}</ModForm>
              <ModForm action={setThreadFlagAction} fields={{ id: th.id, flag: "locked", value: th.locked ? "0" : "1", back }} testid="thread-lock">{th.locked ? t("අනලොක් කරන්න") : t("ලොක් කරන්න")}</ModForm>
              <ModForm action={setThreadFlagAction} fields={{ id: th.id, flag: "pinned", value: th.pinned ? "0" : "1", back }} testid="thread-pin">{th.pinned ? t("සවි කිරීම ඉවත් කරන්න") : t("ඉහළට සවි කරන්න")}</ModForm>
              <ModForm action={deleteThreadAction} fields={{ id: th.id }} confirm={t("මෙම මාතෘකාව සහ එහි සියලු පිළිතුරු මකා දමන්නද?")}>{t("මකන්න")}</ModForm>
              {authorIsStudent && <MuteBox userId={row.authorId} back={back} t={t} />}
            </>
          )}
        </div>
      </article>

      <section className="space-y-3" aria-label={t("පිළිතුරු")}>
        <h2 className="font-display text-lg font-bold text-navy">{t("පිළිතුරු {n}", { n: posts.filter((p) => !p.hidden).length })}</h2>
        {posts.length === 0 && <p className="text-sm text-muted">{t("තවම පිළිතුරු නැත. පළමු පිළිතුර ඔබෙන් වේවා!")}</p>}
        <ul className="space-y-3" data-testid="post-list">
          {posts.map((p) => {
            const pa = authorOf(p, t);
            return (
              <li key={p.id} data-post={p.id} data-hidden={p.hidden ? "1" : "0"} className={`card p-4 ${p.hidden ? "opacity-60" : ""}`}>
                <Author a={pa} t={t} when={formatColombo(p.createdAt)} />
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{p.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!ctx.isAdmin && p.authorId !== ctx.user.id && (
                    <ModForm action={reportAction} fields={{ kind: "POST", id: p.id, back }} confirm={t("මෙය ගුරුතුමාට වාර්තා කරන්නද?")}>
                      {t("වාර්තා කරන්න")}
                    </ModForm>
                  )}
                  {ctx.isAdmin && (
                    <>
                      {p.hidden && <Chip tone="violet">{t("සැඟවූ")}</Chip>}
                      <ModForm action={setPostHiddenAction} fields={{ id: p.id, value: p.hidden ? "0" : "1", back }} testid="post-hide">{p.hidden ? t("නැවත පෙන්වන්න") : t("සඟවන්න")}</ModForm>
                      <ModForm action={deletePostAction} fields={{ id: p.id, back }} confirm={t("මෙම පිළිතුර මකා දමන්නද?")}>{t("මකන්න")}</ModForm>
                      {pa.staff ? null : <MuteBox userId={p.authorId} back={back} t={t} />}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div id="end" />
      </section>

      {th.locked && !ctx.isAdmin ? (
        <Alert kind="warning">{t("මෙම මාතෘකාව ලොක් කර ඇත. අලුත් පිළිතුරු යැවිය නොහැක.")}</Alert>
      ) : mute ? (
        <Alert kind="warning">{t("ගුරුතුමා විසින් ඔබට දැනට පණිවිඩ යැවීම නවත්වා ඇත.")}</Alert>
      ) : (
        <section className="card p-4 sm:p-5">
          <ReplyForm action={replyAction} threadId={th.id} />
        </section>
      )}
    </Shell>
  );
}

/* ----------------------------------- Live chat ----------------------------------- */

export async function ChatPage(ctx: Ctx) {
  const t = await getT();
  const { rooms, room } = pickRoom(ctx);
  const [rows, reports, mute] = await Promise.all([recentChat(room, ctx.isAdmin), ctx.isAdmin ? openReports() : Promise.resolve(0), ctx.isAdmin ? null : activeMute(ctx.user.id)]);
  const initial: ChatMsg[] = rows.map((r) => {
    const a = authorOf(r, t);
    return { id: r.id, body: r.body, hidden: r.hidden, at: r.createdAt.toISOString(), name: a.name, sub: a.sub, staff: a.staff, mine: r.authorId === ctx.user.id };
  });
  return (
    <Shell ctx={ctx} tab="chat" reports={reports} subtitle={t("කාමරයේ සිටින අයට සජීවීව පණිවිඩ යවන්න. ඔබේ නම ලෙස මුල් නම සහ ශ්‍රේණිය පමණක් පෙන්වයි.")}>
      <RoomPicker rooms={rooms} active={room} hrefFor={(r) => `${ctx.base}/chat?room=${r}`} t={t} />
      {mute && <Alert kind="warning">{t("ගුරුතුමා විසින් ඔබට දැනට පණිවිඩ යැවීම නවත්වා ඇත. ඔබට කියවීමට පමණක් හැක.")}</Alert>}
      <ChatRoom key={room} room={room} initial={initial} isAdmin={ctx.isAdmin} back={`${ctx.base}/chat?room=${room}`} max={CHAT_MAX} />
    </Shell>
  );
}

/* --------------------------- Admin: වාර්තා සහ පාලනය --------------------------- */

export async function ReportsPage(ctx: Ctx) {
  const t = await getT();
  const open = await db.select().from(communityReports).where(eq(communityReports.status, "OPEN")).orderBy(desc(communityReports.createdAt)).limit(100);
  // වාර්තා කළ අන්තර්ගතය (එකම අන්තර්ගතයට වාර්තා කිහිපයක් එක් කරයි)
  const groups = new Map<string, { kind: string; targetId: string; reporters: number; reasons: string[]; firstId: string }>();
  for (const r of open) {
    const k = `${r.kind}:${r.targetId}`;
    const g = groups.get(k) ?? { kind: r.kind, targetId: r.targetId, reporters: 0, reasons: [], firstId: r.id };
    g.reporters++;
    if (r.reason) g.reasons.push(r.reason);
    groups.set(k, g);
  }
  const list = [...groups.values()];
  const ids = (kind: string) => list.filter((g) => g.kind === kind).map((g) => g.targetId);
  const [threads, posts, chats] = await Promise.all([
    ids("THREAD").length ? db.select({ id: forumThreads.id, body: forumThreads.title, hidden: forumThreads.hidden, authorId: forumThreads.authorId, room: forumThreads.room, aName: users.name, aRole: users.role }).from(forumThreads).innerJoin(users, eq(users.id, forumThreads.authorId)).where(inArray(forumThreads.id, ids("THREAD"))) : [],
    ids("POST").length ? db.select({ id: forumPosts.id, body: forumPosts.body, hidden: forumPosts.hidden, authorId: forumPosts.authorId, room: forumThreads.room, threadId: forumPosts.threadId, aName: users.name, aRole: users.role }).from(forumPosts).innerJoin(forumThreads, eq(forumThreads.id, forumPosts.threadId)).innerJoin(users, eq(users.id, forumPosts.authorId)).where(inArray(forumPosts.id, ids("POST"))) : [],
    ids("CHAT").length ? db.select({ id: chatMessages.id, body: chatMessages.body, hidden: chatMessages.hidden, authorId: chatMessages.authorId, room: chatMessages.room, aName: users.name, aRole: users.role }).from(chatMessages).innerJoin(users, eq(users.id, chatMessages.authorId)).where(inArray(chatMessages.id, ids("CHAT"))) : [],
  ]);
  const byId = new Map<string, { body: string; hidden: boolean; authorId: string; room: string; aName: string; aRole: string; threadId?: string }>();
  for (const x of [...threads, ...posts, ...chats]) byId.set(x.id, x);
  const mutes = await db
    .select({ userId: communityMutes.userId, until: communityMutes.until, reason: communityMutes.reason, name: users.name })
    .from(communityMutes)
    .innerJoin(users, eq(users.id, communityMutes.userId))
    .orderBy(desc(communityMutes.createdAt))
    .limit(100);
  const now = nowMs();
  const kindLabel: Record<string, string> = { THREAD: "මාතෘකාව", POST: "පිළිතුර", CHAT: "Live chat" };
  return (
    <Shell ctx={ctx} tab="reports" reports={groups.size}>
      <section className="space-y-3" aria-label={t("වාර්තා")}>
        <h2 className="font-display text-lg font-bold text-navy">{t("නිරාකරණය නොකළ වාර්තා")}</h2>
        {list.length === 0 ? (
          <EmptyState icon="check">{t("නිරාකරණය කළ යුතු වාර්තා නැත. 🎉")}</EmptyState>
        ) : (
          <ul className="space-y-3" data-testid="report-list">
            {list.map((g) => {
              const c = byId.get(g.targetId);
              const href = g.kind === "THREAD" ? `${ctx.base}/${g.targetId}` : g.kind === "POST" && c?.threadId ? `${ctx.base}/${c.threadId}` : `${ctx.base}/chat?room=${c?.room ?? ""}`;
              return (
                <li key={`${g.kind}:${g.targetId}`} data-report={g.kind} className="card space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="red">{t(kindLabel[g.kind])}</Chip>
                    {c && <Chip tone="blue">{roomLabel(c.room, t as never)}</Chip>}
                    <Chip tone="sun">{t("වාර්තා {n}", { n: g.reporters })}</Chip>
                    {c?.hidden && <Chip tone="violet">{t("සැඟවූ")}</Chip>}
                  </div>
                  {c ? (
                    <>
                      <p className="whitespace-pre-line rounded-xl bg-surface p-3 text-sm [overflow-wrap:anywhere]">{c.body}</p>
                      <p className="text-xs text-muted">
                        {t("ලියූ අය")}: <strong>{c.aName}</strong>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">{t("අන්තර්ගතය මකා දමා ඇත.")}</p>
                  )}
                  {g.reasons.length > 0 && <p className="text-xs text-muted">{t("හේතු")}: {g.reasons.join(" | ")}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {c && (
                      <Link href={href} className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-primary hover:bg-primary-soft">
                        {t("බලන්න")}
                      </Link>
                    )}
                    <ModForm action={resolveReportAction} fields={{ id: g.firstId, hide: "1" }} testid="report-hide">{t("සඟවා නිරාකරණය කරන්න")}</ModForm>
                    <ModForm action={resolveReportAction} fields={{ id: g.firstId }} testid="report-dismiss">{t("නිරාකරණය කරන්න (සැඟවීමක් නැත)")}</ModForm>
                    {c && c.aRole === "STUDENT" && <MuteBox userId={c.authorId} back="/admin/community/reports" t={t} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-label={t("Mute කළ සිසුන්")}>
        <h2 className="font-display text-lg font-bold text-navy">{t("පණිවිඩ යැවීම නවත්වා ඇති සිසුන්")}</h2>
        {mutes.length === 0 ? (
          <p className="text-sm text-muted">{t("කිසිවෙකු නැත.")}</p>
        ) : (
          <ul className="space-y-2" data-testid="mute-list">
            {mutes.map((m) => {
              const active = !m.until || m.until.getTime() > now;
              return (
                <li key={m.userId} data-muted={m.userId} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                  <p className="text-sm">
                    <strong>{m.name}</strong>{" "}
                    <span className="text-muted">
                      {!active ? t("කල් ඉකුත් වී ඇත") : m.until ? t("{when} දක්වා", { when: formatColombo(m.until) }) : t("ස්ථිරව")}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </span>
                  </p>
                  <ModForm action={unmuteUserAction} fields={{ userId: m.userId, back: "/admin/community/reports" }} testid="unmute">{t("නැවත විවෘත කරන්න")}</ModForm>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Shell>
  );
}


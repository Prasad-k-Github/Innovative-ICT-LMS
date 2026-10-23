import "server-only";
import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, communityMutes, forumPosts, forumThreads, userAvatars, users } from "@/db/schema";
import type { T } from "./i18n/core";
import { authorDisplay } from "./community";
import { avatarSrc, canSeeAvatar, type AvatarViewer } from "./avatar";

const authorCols = { aId: users.id, aName: users.name, aRole: users.role, aGrade: users.grade, aYear: users.alYear, aAvatarAt: userAvatars.updatedAt };
type AuthorRow = { aId: string; aName: string; aRole: string; aGrade: number; aYear: number | null; aAvatarAt: Date | null };
// viewer: බලන්නා. ඡායාරූපය පෙන්වන්නේ privacy නීතියට අනුවය (canSeeAvatar)
export const authorOf = (r: AuthorRow, t: T, viewer?: AvatarViewer | null) => ({
  ...authorDisplay({ name: r.aName, role: r.aRole, grade: r.aGrade, alYear: r.aYear }, t),
  avatar: r.aAvatarAt && canSeeAvatar(viewer, { id: r.aId, role: r.aRole }) ? avatarSrc(r.aId, r.aAvatarAt) : (null as string | null),
});

// නවතා ඇත්නම් (තවමත් කල් ඉකුත් වී නැත්නම්) mute පේළිය
export async function activeMute(userId: string) {
  const [m] = await db
    .select()
    .from(communityMutes)
    .where(and(eq(communityMutes.userId, userId), or(isNull(communityMutes.until), gt(communityMutes.until, new Date()))))
    .limit(1);
  return m ?? null;
}

export async function listThreads(room: string, includeHidden: boolean, limit = 50) {
  return db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      pinned: forumThreads.pinned,
      locked: forumThreads.locked,
      hidden: forumThreads.hidden,
      replyCount: forumThreads.replyCount,
      lastActivityAt: forumThreads.lastActivityAt,
      createdAt: forumThreads.createdAt,
      ...authorCols,
    })
    .from(forumThreads)
    .innerJoin(users, eq(users.id, forumThreads.authorId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(and(eq(forumThreads.room, room), includeHidden ? undefined : eq(forumThreads.hidden, false)))
    .orderBy(desc(forumThreads.pinned), desc(forumThreads.lastActivityAt))
    .limit(limit);
}

export async function getThread(id: string) {
  const [row] = await db
    .select({ thread: forumThreads, ...authorCols, authorId: users.id })
    .from(forumThreads)
    .innerJoin(users, eq(users.id, forumThreads.authorId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(eq(forumThreads.id, id))
    .limit(1);
  return row ?? null;
}

export async function listPosts(threadId: string, includeHidden: boolean) {
  return db
    .select({ id: forumPosts.id, body: forumPosts.body, hidden: forumPosts.hidden, createdAt: forumPosts.createdAt, authorId: forumPosts.authorId, ...authorCols })
    .from(forumPosts)
    .innerJoin(users, eq(users.id, forumPosts.authorId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(and(eq(forumPosts.threadId, threadId), includeHidden ? undefined : eq(forumPosts.hidden, false)))
    .orderBy(asc(forumPosts.createdAt))
    .limit(300);
}

// Live chat: කාමරයේ අවසන් පණිවිඩ (පරණ → අලුත්)
export async function recentChat(room: string, includeHidden: boolean, limit = 50) {
  const rows = await db
    .select({ id: chatMessages.id, body: chatMessages.body, hidden: chatMessages.hidden, createdAt: chatMessages.createdAt, authorId: chatMessages.authorId, ...authorCols })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(and(eq(chatMessages.room, room), includeHidden ? undefined : eq(chatMessages.hidden, false)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}
export const nowMs = () => Date.now();

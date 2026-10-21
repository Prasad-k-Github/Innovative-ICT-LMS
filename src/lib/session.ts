import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";
import { generateToken, hashToken } from "./crypto";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STUDENT";
  grade: number;
  medium: "SINHALA" | "ENGLISH" | null;
  alYear: number | null;
  school: string;
  phone: string;
  instituteId: string | null;
};

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  // කල් ඉකුත් වූ sessions පිරිසිදු කිරීම
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  // කලාතුරකින් සියලු පරිශීලකයන්ගේ කල් ඉකුත් වූ sessions සහ tokens ද ඉවත් කරයි
  if (Math.random() < 0.02) {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date()));
  }

  await db
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

// සෑම request එකකදීම database එකෙන් පරීක්ෂා කරන නිසා, Admin ට suspend/delete
// කළ විගස ප්‍රවේශය නැති වේ. (Cookie එක පමණක් විශ්වාස නොකරයි.)
const loadSessionRow = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row?.user ?? null;
});

function toSessionUser(u: typeof users.$inferSelect): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    grade: u.grade,
    medium: u.medium,
    alYear: u.alYear,
    school: u.school,
    phone: u.phone,
    instituteId: u.instituteId,
  };
}

// සක්‍රිය (ACTIVE) සහ email තහවුරු කළ පරිශීලකයා පමණි. අනෙක් සියල්ල (අනුමැතිය බලාපොරොත්තුවෙන්, අත්හිටුවා ඇති) "login වී නැත" ලෙස සැලකේ.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const u = await loadSessionRow();
  if (!u || u.status !== "ACTIVE" || !u.emailVerified) return null;
  return toSessionUser(u);
});

// Email තහවුරු කර Admin අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුවා. ඔහුට පෙන්වන්නේ "අනුමැතිය බලාපොරොත්තුවෙන්" පණිවිඩය පමණි.
export const getPendingStudent = cache(async (): Promise<SessionUser | null> => {
  const u = await loadSessionRow();
  if (!u || u.role !== "STUDENT" || u.status !== "PENDING" || !u.emailVerified) return null;
  return toSessionUser(u);
});

export async function requireStudent() {
  const user = await getCurrentUser();
  if (!user) redirect((await getPendingStudent()) ? "/dashboard" : "/login");
  if (user.role !== "STUDENT") redirect("/admin");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/dashboard");
  return user;
}

// ගුරුවරයා (Super Admin) පමණක්: Admin ලා කළමනාකරණය සහ ක්‍රියා ඉතිහාසය
export async function requireSuperAdmin() {
  const user = await requireAdmin();
  if (user.role !== "SUPER_ADMIN") redirect("/admin");
  return user;
}

// ඕනෑම සක්‍රිය පරිශීලකයෙක් (Admin හෝ සිසුවා)
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdminRole(role: SessionUser["role"]) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// පරිශීලකයාගේ සියලු sessions ඉවත් කිරීම (suspend / delete / මුරපදය වෙනස් කිරීම)
export async function revokeAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

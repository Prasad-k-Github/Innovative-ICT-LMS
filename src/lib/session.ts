import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";
import {
  MFA_PENDING_MINUTES,
  SESSION_ADMIN_HOURS,
  SESSION_ADMIN_IDLE_MINUTES,
  SESSION_COOKIE,
  SESSION_DAYS,
  SESSION_STUDENT_IDLE_DAYS,
} from "./constants";
import { audit } from "./audit";
import { generateToken, hashToken } from "./crypto";
import { rateLimit } from "./rate-limit";
import { requestContext } from "./request-context";

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

const isAdminRoleName = (r: string) => r === "ADMIN" || r === "SUPER_ADMIN";

// Session policy: Admin ලාට කෙටි (උපරිම පැය 12, අක්‍රිය විනාඩි 60); සිසුන්ට උපරිම දින 7, අක්‍රිය දින 3
function policyFor(role: string) {
  return isAdminRoleName(role)
    ? { absoluteMs: SESSION_ADMIN_HOURS * 3600_000, idleMs: SESSION_ADMIN_IDLE_MINUTES * 60_000 }
    : { absoluteMs: SESSION_DAYS * 86_400_000, idleMs: SESSION_STUDENT_IDLE_DAYS * 86_400_000 };
}

// mfaVerified=false: මුරපදය නිවැරදියි, නමුත් 2-step code තවම ඇතුළත් කර නැත. එවැනි session එකකින් කිසිවක් කළ නොහැක.
export async function createSession(userId: string, opts: { mfaVerified?: boolean } = {}) {
  const mfaVerified = opts.mfaVerified ?? true;
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const policy = policyFor(u?.role ?? "STUDENT");
  const token = generateToken();
  const expiresAt = new Date(Date.now() + (mfaVerified ? policy.absoluteMs : MFA_PENDING_MINUTES * 60_000));
  const ctx = await requestContext();

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
    .values({ tokenHash: hashToken(token), userId, expiresAt, ip: ctx.ip, userAgent: ctx.userAgent, mfaVerified });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// 2-step code සාර්ථක වූ විට: වත්මන් session එක සම්පූර්ණ ප්‍රවේශයට උසස් කරයි (token අලුත් කර, කාලය නැවත සකසයි: session fixation වැළැක්වීමට)
export async function promoteSession(userId: string) {
  await destroySession();
  await createSession(userId, { mfaVerified: true });
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
// අක්‍රිය (idle) කාලය ඉක්මවූ session ඉවත් කරයි; භාවිතයේ ඇති session හි lastSeenAt විනාඩියකට වරක් යාවත්කාලීන කරයි.
const loadSession = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;

  const now = Date.now();
  const policy = policyFor(row.user.role);
  if (row.session.mfaVerified && now - row.session.lastSeenAt.getTime() > policy.idleMs) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  if (now - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, row.session.id));
  }
  return row;
});

// (පරණ නම): සම්පූර්ණයෙන්ම සත්‍යාපනය වූ (2-step සමඟ) session එකේ පරිශීලකයා පමණි
const loadSessionRow = cache(async () => {
  const r = await loadSession();
  return r && r.session.mfaVerified ? r.user : null;
});

// මුරපදය නිවැරදි කර 2-step code බලාපොරොත්තුවෙන් සිටින පරිශීලකයා
export const getMfaPendingUser = cache(async () => {
  const r = await loadSession();
  if (!r || r.session.mfaVerified || !r.user.mfaSecretEnc) return null;
  return { id: r.user.id, email: r.user.email, name: r.user.name };
});

export async function getCurrentSessionId() {
  const r = await loadSession();
  return r && r.session.mfaVerified ? r.session.id : null;
}

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

// Accounting: සත්‍යාපනය වූ පරිශීලකයෙක් තමාට අයත් නොවන කොටසකට පිවිසීමට උත්සාහ කළ විට log කරයි (විනාඩි 10කට උපරිම 20)
async function logDenied(user: SessionUser) {
  try {
    const path = (await headers()).get("x-pathname");
    if (await rateLimit(`denied:${user.id}`, 20, 10 * 60_000)) {
      await audit(user.id, "access.denied", path?.slice(0, 200) ?? undefined, `role:${user.role}`, user.id);
    }
  } catch {
    /* logging අසාර්ථක වීම ප්‍රවේශ පාලනයට බලපාන්නේ නැත */
  }
}

export async function requireStudent() {
  const user = await getCurrentUser();
  if (!user) redirect((await getPendingStudent()) ? "/dashboard" : "/login");
  if (user.role !== "STUDENT") {
    await logDenied(user);
    redirect("/admin");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) {
    await logDenied(user);
    redirect("/dashboard");
  }
  return user;
}

// ගුරුවරයා (Super Admin) පමණක්: Admin ලා කළමනාකරණය සහ ක්‍රියා ඉතිහාසය
export async function requireSuperAdmin() {
  const user = await requireAdmin();
  if (user.role !== "SUPER_ADMIN") {
    await logDenied(user);
    redirect("/admin");
  }
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

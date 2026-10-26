import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";
import {
  MFA_PENDING_MINUTES,
  NEXT_COOKIE,
  SESSION_ADMIN_HOURS,
  SESSION_ADMIN_IDLE_MINUTES,
  SESSION_COOKIE,
  SESSION_DAYS,
  SESSION_HINT_COOKIE,
  SESSION_MAX_ADMIN,
  SESSION_MAX_STUDENT,
  SESSION_STUDENT_IDLE_DAYS,
} from "./constants";
import { loginUrl, safeNext, type EndReason } from "./session-reason";
import { audit } from "./audit";
import { generateToken, hashToken } from "./crypto";
import { rateLimit } from "./rate-limit";
import { requestContext } from "./request-context";
import { adminMfaRequired } from "./mfa-policy";
import { onboardingStep, type OnboardingStep } from "./onboarding";

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
  indexNo: string | null;
  mfaEnabled: boolean;
  onboardingStep: OnboardingStep | null; // සිසුවා තවම සම්පූර්ණ නොකළ පළමු login පියවර
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

  // කල් ඉකුත් වූ සහ අක්‍රිය වූ sessions පිරිසිදු කිරීම
  const nowDate = new Date();
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, nowDate)));
  // කලාතුරකින් සියලු පරිශීලකයන්ගේ කල් ඉකුත් වූ / අක්‍රිය sessions සහ tokens ද ඉවත් කරයි
  if (Math.random() < 0.02) await purgeStale();

  await db
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt, ip: ctx.ip, userAgent: ctx.userAgent, mfaVerified });

  // එකවර සක්‍රිය devices සීමාව: සීමාව ඉක්මවන පැරණිතම (අවසන් භාවිතය අනුව) sessions ඉවත් කරයි
  if (mfaVerified) {
    const max = isAdminRoleName(u?.role ?? "STUDENT") ? SESSION_MAX_ADMIN : SESSION_MAX_STUDENT;
    const live = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.mfaVerified, true)))
      .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt));
    const extra = live.slice(max).map((r) => r.id);
    if (extra.length) {
      await db.delete(sessions).where(inArray(sessions.id, extra));
      await audit(userId, "session.limit", undefined, String(extra.length), userId);
    }
  }

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge, expires: expiresAt });
  // රහස් නොවන සලකුණ (JS වලට කියවිය හැක): session cookie එක ඉකුත් වී ඇතිවිට "session කල් ඉකුත් විය" යැයි පෙන්වීමට පමණි
  if (mfaVerified) store.set(SESSION_HINT_COOKIE, "1", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: 30 * 86_400 });
}

// සියලු පරිශීලකයන්ගේ කල් ඉකුත් වූ, අක්‍රිය වූ sessions සහ tokens ඉවත් කරයි
export async function purgeStale() {
  const now = Date.now();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));
  await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date(now)));
  // අක්‍රිය: සිසුන් දින 3ට වැඩි, Admin ලා විනාඩි 60ට වැඩි (2-step බලාපොරොත්තු sessions නොවේ)
  // සටහන: raw sql තුළට Date කෙලින්ම දැමීමෙන් වැළකින්න: pg driver එය server එකේ ප්‍රාදේශීය වේලාව + offset සමඟ යවයි (Asia/Colombo හිදී පැය 5½ ක් ඉදිරියට ගොස් සජීවී sessions මකා දමයි).
  // Drizzle column වල UTC ලෙස ගබඩා වන නිසා UTC ISO string එකක් timestamp ලෙස cast කරයි.
  const studentCut = new Date(now - SESSION_STUDENT_IDLE_DAYS * 86_400_000).toISOString();
  const adminCut = new Date(now - SESSION_ADMIN_IDLE_MINUTES * 60_000).toISOString();
  await db.execute(sql`
    delete from sessions s using users u
    where u.id = s.user_id and s.mfa_verified = true and (
      (u.role = 'STUDENT' and s.last_seen_at < ${studentCut}::timestamp)
      or (u.role <> 'STUDENT' and s.last_seen_at < ${adminCut}::timestamp)
    )`);
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
  store.delete(SESSION_HINT_COOKIE);
}

// සෑම request එකකදීම database එකෙන් පරීක්ෂා කරන නිසා, Admin ට suspend/delete
// කළ විගස ප්‍රවේශය නැති වේ. (Cookie එක පමණක් විශ්වාස නොකරයි.)
// අක්‍රිය (idle) කාලය ඉක්මවූ session ඉවත් කරයි; භාවිතයේ ඇති session හි lastSeenAt විනාඩියකට වරක් යාවත්කාලීන කරයි.
// touch=false: පසුබිම් polling (chat, දැනුම්දීම්, session පරීක්ෂාව): ඒවා "පරිශීලක ක්‍රියාකාරිත්වයක්" ලෙස නොගණන අතර idle කාලය දිගු නොකරයි.
type SessionRow = { user: typeof users.$inferSelect; session: typeof sessions.$inferSelect };
export type Loaded = ({ state: "ok" } & SessionRow) | { state: "none" } | { state: "ended"; reason: Exclude<EndReason, "logout"> };

const loadSession = cache(async (touch: boolean): Promise<Loaded> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return { state: "none" };

  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  // cookie එක ඇත, නමුත් session එක නැත: වෙනත් තැනකින් logout / අවසන් කිරීම / device සීමාව / මුරපදය වෙනස් කිරීම
  if (!row) return { state: "ended", reason: "revoked" };

  const now = Date.now();
  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return { state: "ended", reason: "expired" };
  }
  const policy = policyFor(row.user.role);
  if (row.session.mfaVerified && now - row.session.lastSeenAt.getTime() > policy.idleMs) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return { state: "ended", reason: "idle" };
  }
  if (touch && now - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, row.session.id));
  }
  return { state: "ok", ...row };
});

const okRow = (l: Loaded) => (l.state === "ok" ? l : null);

// Client SessionGuard සඳහා: ඉතිරි අක්‍රිය / උපරිම කාලය (ms). touch=true: පරිශීලක ක්‍රියාකාරිත්වයක් ලෙස idle කාලය නැවත ආරම්භ කරයි
export type SessionStatus = { state: "ok"; userId: string; idleLeftMs: number; absLeftMs: number; mfa: boolean } | { state: "none" } | { state: "ended"; reason: Exclude<EndReason, "logout"> };
export async function sessionStatus(touch: boolean): Promise<SessionStatus> {
  const l = await loadSession(false);
  if (l.state !== "ok" || !l.session.mfaVerified) return l.state === "ended" ? l : { state: "none" };
  const now = Date.now();
  if (touch && now - l.session.lastSeenAt.getTime() > 5_000) {
    await db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, l.session.id));
    l.session.lastSeenAt = new Date(now);
  }
  const policy = policyFor(l.user.role);
  return { state: "ok", userId: l.user.id, idleLeftMs: l.session.lastSeenAt.getTime() + policy.idleMs - now, absLeftMs: l.session.expiresAt.getTime() - now, mfa: !!(l.user.mfaEnabledAt && l.user.mfaSecretEnc) };
}

// Login පිටුවේදී: වලංගු නොවන (ඉකුත් වූ / අවසන් කළ) session cookie එක ඉවත් කරයි
export async function clearStaleSession() {
  const l = await loadSession(false);
  if (l.state === "ok") return;
  const store = await cookies();
  if (l.state === "ended") store.delete(SESSION_COOKIE);
  store.delete(SESSION_HINT_COOKIE);
}

// Login වූ පසු යා යුතු පිටුව: login පෝරමයෙන් එන `next` (වලංගු නම්) විනාඩි 10ක් cookie එකක තබයි (2-step පියවර හරහාද ඉතිරි වේ)
export async function rememberNext(raw: unknown) {
  const store = await cookies();
  const n = safeNext(raw);
  if (n) store.set(NEXT_COOKIE, n, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  else store.delete(NEXT_COOKIE);
}

export async function postLoginPath(role: SessionUser["role"]) {
  const store = await cookies();
  const n = safeNext(store.get(NEXT_COOKIE)?.value);
  store.delete(NEXT_COOKIE);
  const home = role === "STUDENT" ? "/dashboard" : "/admin";
  const area = role === "STUDENT" ? "/dashboard" : "/admin";
  return n && (n === area || n.startsWith(area + "/")) ? n : home;
}

// (පරණ නම): සම්පූර්ණයෙන්ම සත්‍යාපනය වූ (2-step සමඟ) session එකේ පරිශීලකයා පමණි
const loadSessionRow = cache(async (touch: boolean) => {
  const r = okRow(await loadSession(touch));
  return r && r.session.mfaVerified ? r.user : null;
});

// මුරපදය නිවැරදි කර 2-step code බලාපොරොත්තුවෙන් සිටින පරිශීලකයා
export const getMfaPendingUser = cache(async () => {
  const r = okRow(await loadSession(true));
  if (!r || r.session.mfaVerified || !r.user.mfaSecretEnc) return null;
  return { id: r.user.id, email: r.user.email, name: r.user.name };
});

export async function getCurrentSessionId(touch: boolean = true) {
  const r = okRow(await loadSession(touch));
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
    indexNo: u.indexNo,
    mfaEnabled: !!(u.mfaEnabledAt && u.mfaSecretEnc),
    onboardingStep: onboardingStep(u),
  };
}

// සක්‍රිය (ACTIVE) සහ email තහවුරු කළ පරිශීලකයා පමණි. අනෙක් සියල්ල (අනුමැතිය බලාපොරොත්තුවෙන්, අත්හිටුවා ඇති) "login වී නැත" ලෙස සැලකේ.
export const getCurrentUser = cache(async (touch: boolean = true): Promise<SessionUser | null> => {
  const u = await loadSessionRow(touch);
  if (!u || u.status !== "ACTIVE" || !u.emailVerified) return null;
  return toSessionUser(u);
});

// Email තහවුරු කර Admin අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුවා. ඔහුට පෙන්වන්නේ "අනුමැතිය බලාපොරොත්තුවෙන්" පණිවිඩය පමණි.
export const getPendingStudent = cache(async (): Promise<SessionUser | null> => {
  const u = await loadSessionRow(true);
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

// Login නැති / session අවසන් වූ විට: හේතුව සහ දැන් සිටි පිටුව සමඟ /login වෙත යවයි
export async function toLogin(): Promise<never> {
  const l = await loadSession(true);
  const path = (await headers()).get("x-pathname");
  redirect(loginUrl(l.state === "ended" ? l.reason : null, path));
}

export async function requireStudent() {
  const user = await getCurrentUser();
  if (!user) return (await getPendingStudent()) ? redirect("/dashboard") : toLogin();
  if (user.role !== "STUDENT") {
    await logDenied(user);
    redirect("/admin");
  }
  // පළමු login පියවර (මුරපදය / email තහවුරු / එකඟත්වය) සම්පූර්ණ කරන තෙක් වෙන කිසිවක් කළ නොහැක (පිටු සහ actions දෙකටම)
  if (user.onboardingStep) redirect("/welcome");
  return user;
}

// පළමු login පියවර පිටු (/welcome) සහ ඒවායේ actions සඳහා පමණි: සිසුවා පමණක්; පියවර ගේට්ටුව නොබලයි
export async function requireStudentSetup() {
  const user = await getCurrentUser();
  if (!user) return toLogin();
  if (user.role !== "STUDENT") {
    await logDenied(user);
    redirect("/admin");
  }
  return user;
}

// 2-step verification අනිවාර්ය නම්, එය සකස් කරන තෙක් Admin ට වෙන කිසිවක් කළ නොහැක (පිටු, actions, downloads සියල්ලටම)
// Admin භූමිකාව පමණක් පරීක්ෂා කරයි (2-step අනිවාර්ය බව නොබලයි): "මගේ ගිණුම" පිටුව සහ 2-step සකස් කිරීමේ actions සඳහා පමණි
export async function requireAdminSetup() {
  const user = await getCurrentUser();
  if (!user) return toLogin();
  if (!isAdminRole(user.role)) {
    await logDenied(user);
    redirect("/dashboard");
  }
  return user;
}

// 2-step verification අනිවාර්ය නම්, එය සකස් කරන තෙක් Admin ට වෙන කිසිවක් කළ නොහැක (පිටු, actions, downloads සියල්ලටම)
export async function requireAdmin() {
  const user = await requireAdminSetup();
  if (adminMfaRequired() && !user.mfaEnabled) redirect("/admin/account?tab=2step&mfa=required");
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
export async function requireUser(touch: boolean = true) {
  const user = await getCurrentUser(touch);
  if (!user) return toLogin();
  return user;
}

export function isAdminRole(role: SessionUser["role"]) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// API/route handlers සඳහා: Admin භූමිකාව සහ (අනිවාර්ය නම්) 2-step සක්‍රිය කර තිබීම
export function isAdminUser(user: Pick<SessionUser, "role" | "mfaEnabled">) {
  return isAdminRole(user.role) && (!adminMfaRequired() || user.mfaEnabled);
}

// පරිශීලකයාගේ සියලු sessions ඉවත් කිරීම (suspend / delete / මුරපදය වෙනස් කිරීම)
export async function revokeAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

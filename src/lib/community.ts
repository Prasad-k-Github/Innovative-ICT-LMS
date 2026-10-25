import { AL_GRADE, GRADES, gradeGroup, gradeLabel } from "./constants";
import type { T } from "./i18n/core";

// සංවාද මණ්ඩපයේ කාමර: "general" (සියලු දෙනා) + ශ්‍රේණියක් බැගින්. සිසුවාට තමන්ගේ ශ්‍රේණි කාමරය සහ general පමණි
export const GENERAL_ROOM = "general";
export const ROOM_KEYS = [GENERAL_ROOM, ...GRADES.map((g) => roomOfGrade(g))] as string[];

export function roomOfGrade(grade: number) {
  return grade === AL_GRADE ? "al" : `g${grade}`;
}

export function isRoom(v: unknown): v is string {
  return typeof v === "string" && ROOM_KEYS.includes(v);
}

export function roomLabel(room: string, t: T) {
  if (room === GENERAL_ROOM) return t("පොදු කාමරය (සියලු දෙනා)");
  if (room === "al") return gradeLabel(AL_GRADE, null, t);
  const g = Number(room.slice(1));
  return Number.isFinite(g) ? gradeLabel(g, null, t) : room;
}

export function canAccessRoom(user: { role: string; grade: number }, room: string) {
  if (!isRoom(room)) return false;
  if (user.role !== "STUDENT") return true;
  // O/L ශ්‍රේණි 10 සහ 11 සිසුන්ට දෙකේම කාමර ඇත
  return room === GENERAL_ROOM || gradeGroup(user.grade).some((g) => room === roomOfGrade(g));
}

// සිසුන්ට පෙනෙන කාමර ලැයිස්තුව (පළමුව තමන්ගේ ශ්‍රේණිය)
export function roomsFor(user: { role: string; grade: number }) {
  if (user.role !== "STUDENT") return ROOM_KEYS;
  const own = roomOfGrade(user.grade);
  const others = gradeGroup(user.grade).map(roomOfGrade).filter((r) => r !== own);
  return [own, ...others, GENERAL_ROOM];
}

// පෙන්වන නම: සිසුවා → මුල් නම පමණි; Admin → සම්පූර්ණ නම (සහ ගුරු ලකුණ)
export function authorDisplay(a: { name: string; role: string; grade: number; alYear: number | null }, t: T) {
  const isStaff = a.role !== "STUDENT";
  const first = a.name.trim().split(/\s+/).filter(Boolean)[0] ?? "-";
  return {
    name: isStaff ? a.name.slice(0, 60) : first.slice(0, 40),
    sub: isStaff ? "" : gradeLabel(a.grade, a.alYear, t),
    staff: isStaff,
  };
}

// ළමයින්ගේ ආරක්ෂාව: සිසුන්ට link, email, දුරකථන අංක යැවීමට ඉඩ නැත (Admin ට ඉඩ ඇත)
export function containsContactInfo(text: string): boolean {
  const s = text.normalize("NFKC");
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|lk|net|org|io|me|link|xyz|info|gl|ly|co)\b)/i.test(s)) return true;
  if (/[\w.+-]+\s?@\s?[\w-]+/.test(s)) return true;
  const digits = s.replace(/[\s\-().]/g, "");
  if (/\+?\d{9,}/.test(digits)) return true;
  if (/(t\.me|wa\.me|whatsapp|telegram|facebook|instagram|tiktok)/i.test(s)) return true;
  return false;
}

export const CONTACT_INFO_ERROR = "ආරක්ෂාව සඳහා link, email, දුරකථන අංක එක් කළ නොහැක.";
export const MUTED_ERROR = "ගුරුතුමා විසින් ඔබට දැනට පණිවිඩ යැවීම නවත්වා ඇත.";
export const CHAT_MAX = 300;
export const CHAT_KEEP_DAYS = 30;

// පැත්තේ Live chat dock එකේ සැකසුම (layout වලින් AppShell වෙත)
export function dockConfigFor(user: { role: string; grade: number }, t: T, base: "/dashboard/community" | "/admin/community") {
  const rooms = roomsFor(user);
  const isAdmin = user.role !== "STUDENT";
  return {
    rooms,
    labels: Object.fromEntries(rooms.map((r) => [r, roomLabel(r, t)])) as Record<string, string>,
    defaultRoom: isAdmin ? GENERAL_ROOM : roomOfGrade(user.grade),
    isAdmin,
    base,
    max: CHAT_MAX,
  };
}

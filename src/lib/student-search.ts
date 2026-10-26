import { and, asc, desc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assignments, lessons, quizzes, resources } from "@/db/schema";
import { eligibleFor } from "@/lib/assessment";
import { CONTENT_TYPE_LABELS, RESOURCE_SLUG, gradeGroup } from "@/lib/constants";
import type { SessionUser } from "@/lib/session";

// සිසුවාගේ Dashboard සෙවුම: පාඩම්, Tutes, Papers/Notes/Recordings, Quiz සහ පැවරුම් (උසස් පෙරහන් සමඟ)
export const SEARCH_TYPES = ["all", "LESSON", "TUTE", "PAST_PAPER", "MODEL_PAPER", "NOTE", "RECORDING", "TEXTBOOK", "WORKBOOK", "ESSAY", "QUIZ", "ASSIGNMENT"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export const SEARCH_SORTS = ["relevance", "newest", "title"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export type SearchParams = { q: string; type: SearchType; grade: number | null; year: number | null; sort: SearchSort };
export type SearchItem = { key: string; href: string; title: string; grade: number; kind: "LESSON" | "TUTE" | "FILE" | "QUIZ" | "ASSIGNMENT"; fileType?: string; order?: number; year?: number | null };

// LIKE විශේෂ අකුරු (% _ \) සාමාන්‍ය අකුරු ලෙස සලකයි
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseSearchParams(sp: Record<string, string | string[] | undefined>, group: number[]): SearchParams {
  const q = first(sp.q).trim().slice(0, 60);
  const type = (SEARCH_TYPES as readonly string[]).includes(first(sp.type)) ? (first(sp.type) as SearchType) : "all";
  const g = Number(first(sp.sg));
  const y = Number(first(sp.year));
  const sort = (SEARCH_SORTS as readonly string[]).includes(first(sp.sort)) ? (first(sp.sort) as SearchSort) : "relevance";
  return {
    q,
    type,
    grade: Number.isInteger(g) && group.includes(g) ? g : null,
    year: Number.isInteger(y) && y >= 1990 && y <= 2100 ? y : null,
    sort,
  };
}

// පෙරහනක් (type/grade/year) හෝ අකුරු 2ක පෙළක් තිබේ නම් සෙවුම ක්‍රියාත්මක වේ
export const searchActive = (p: SearchParams) => p.q.length >= 2 || p.type !== "all" || p.grade !== null || p.year !== null;

export async function searchStudentContent(user: SessionUser, p: SearchParams): Promise<SearchItem[]> {
  const medium = user.medium;
  if (!medium || !searchActive(p) || (p.q.length > 0 && p.q.length < 2)) return [];
  const group = p.grade ? [p.grade] : gradeGroup(user.grade);
  const like = `%${escapeLike(p.q)}%`;
  const t = p.type;
  const wantLessons = (t === "all" || t === "LESSON" || t === "TUTE") && p.year === null;
  const wantFiles = t !== "LESSON" && t !== "QUIZ" && t !== "ASSIGNMENT";
  const wantQuiz = (t === "all" || t === "QUIZ") && p.year === null;
  const wantAsg = (t === "all" || t === "ASSIGNMENT") && p.year === null;

  const lessonConds: SQL[] = [ilike(lessons.title, like), inArray(lessons.grade, group), eq(lessons.medium, medium), eq(lessons.isPublished, true)];
  if (t === "LESSON") lessonConds.push(eq(lessons.kind, "LESSON"));
  if (t === "TUTE") lessonConds.push(eq(lessons.kind, "TUTE"));
  const fileConds: SQL[] = [ilike(resources.title, like), inArray(resources.grade, group), eq(resources.medium, medium), eq(resources.isPublished, true)];
  if (t !== "all") fileConds.push(eq(resources.type, t as keyof typeof CONTENT_TYPE_LABELS));
  if (p.year !== null) fileConds.push(eq(resources.year, p.year));

  const [lessonRows, fileRows, quizRows, asgRows] = await Promise.all([
    wantLessons
      ? db
          .select({ id: lessons.id, title: lessons.title, order: lessons.order, grade: lessons.grade, kind: lessons.kind, createdAt: lessons.createdAt })
          .from(lessons)
          .where(and(...lessonConds))
          .orderBy(asc(lessons.grade), asc(lessons.order))
          .limit(30)
      : [],
    wantFiles
      ? db
          .select({ id: resources.id, title: resources.title, type: resources.type, grade: resources.grade, year: resources.year, lessonId: resources.lessonId, lessonKind: lessons.kind, createdAt: resources.createdAt })
          .from(resources)
          .leftJoin(lessons, eq(lessons.id, resources.lessonId))
          .where(and(...fileConds))
          .orderBy(desc(resources.year), desc(resources.createdAt))
          .limit(40)
      : [],
    wantQuiz
      ? db.select({ id: quizzes.id, title: quizzes.title, grade: quizzes.grade, at: quizzes.opensAt }).from(quizzes).where(and(ilike(quizzes.title, like), eligibleFor(user, quizzes), p.grade ? eq(quizzes.grade, p.grade) : undefined)).orderBy(desc(quizzes.opensAt)).limit(15)
      : [],
    wantAsg
      ? db.select({ id: assignments.id, title: assignments.title, grade: assignments.grade, at: assignments.dueAt }).from(assignments).where(and(ilike(assignments.title, like), eligibleFor(user, assignments), p.grade ? eq(assignments.grade, p.grade) : undefined)).orderBy(desc(assignments.dueAt)).limit(15)
      : [],
  ]);

  type Row = SearchItem & { at: number };
  const rows: Row[] = [
    ...lessonRows.map((l): Row => ({
      key: `l${l.id}`,
      href: l.kind === "TUTE" ? `/dashboard/tutes/${l.id}` : `/dashboard/lessons/${l.id}`,
      title: l.title,
      grade: l.grade,
      order: l.order,
      kind: l.kind === "TUTE" ? "TUTE" : "LESSON",
      at: l.createdAt.getTime(),
    })),
    ...fileRows.map((f): Row => ({
      key: `f${f.id}`,
      href: f.lessonId ? (f.lessonKind === "TUTE" ? `/dashboard/tutes/${f.lessonId}` : `/dashboard/lessons/${f.lessonId}`) : `/dashboard/resources/${RESOURCE_SLUG[f.type] ?? "past-papers"}`,
      title: f.title,
      grade: f.grade,
      year: f.year,
      kind: "FILE",
      fileType: f.type,
      at: f.createdAt.getTime(),
    })),
    ...quizRows.map((x): Row => ({ key: `q${x.id}`, href: `/dashboard/quizzes/${x.id}`, title: x.title, grade: x.grade, kind: "QUIZ", at: x.at.getTime() })),
    ...asgRows.map((x): Row => ({ key: `a${x.id}`, href: `/dashboard/assignments/${x.id}`, title: x.title, grade: x.grade, kind: "ASSIGNMENT", at: x.at.getTime() })),
  ];
  if (p.sort === "newest") rows.sort((a, b) => b.at - a.at);
  else if (p.sort === "title") rows.sort((a, b) => a.title.localeCompare(b.title));
  return rows.map(({ at, ...r }) => (void at, r));
}

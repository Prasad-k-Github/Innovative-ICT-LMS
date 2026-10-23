import "server-only";
import { and, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { users } from "@/db/schema";

export type StudentFilters = {
  q: string;
  grade: string;
  medium: string;
  institute: string;
  status: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: SearchParams): StudentFilters {
  return {
    q: first(sp.q).trim().slice(0, 100),
    grade: first(sp.grade),
    medium: first(sp.medium),
    institute: first(sp.institute),
    status: first(sp.status),
  };
}

export function filterQueryString(f: StudentFilters, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// LIKE හි විශේෂ අක්ෂර (%, _, \) සාමාන්‍ය අක්ෂර ලෙස සලකයි
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function studentWhere(f: StudentFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(users.role, "STUDENT")];

  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    conds.push(
      or(ilike(users.name, like), ilike(users.email, like), ilike(users.phone, like), ilike(users.school, like)),
    );
  }
  if (/^\d+$/.test(f.grade)) conds.push(eq(users.grade, Number(f.grade)));
  if (f.medium === "SINHALA" || f.medium === "ENGLISH") conds.push(eq(users.medium, f.medium));
  if (f.institute) conds.push(eq(users.instituteId, f.institute));
  if (f.status === "PENDING" || f.status === "ACTIVE" || f.status === "SUSPENDED") {
    conds.push(eq(users.status, f.status));
  } else if (f.status === "SUSPENDED_TEMP") {
    conds.push(eq(users.status, "SUSPENDED"), isNotNull(users.suspendedUntil));
  } else if (f.status === "SUSPENDED_PERM") {
    conds.push(eq(users.status, "SUSPENDED"), isNull(users.suspendedUntil));
  }
  return and(...conds)!;
}

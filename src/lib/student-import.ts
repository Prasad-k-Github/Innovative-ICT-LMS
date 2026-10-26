import { AL_GRADE, GRADES } from "./constants";
import { parseCsv } from "./csv-parse";

export const IMPORT_MAX_ROWS = 100;
export const IMPORT_MAX_BYTES = 200_000;

export type ImportRow = { line: number; name: string; school: string; grade: string; medium: string; phone: string; email: string; alYear: string; institute: string };
export type ImportRowResult = { line: number; name: string; email: string; ok: boolean; errors: string[] };
export type ImportState = {
  error?: string;
  preview?: { rows: ImportRowResult[]; okCount: number; csv: string; instituteId: string; sendInvites: boolean };
  done?: { created: number; failed: ImportRowResult[]; mailFailed: number; invited: boolean };
};

// තීරු නාම (ඉංග්‍රීසි / සිංහල) → සම්මත යතුරු
const HEADERS: Record<string, keyof Omit<ImportRow, "line">> = {
  name: "name", fullname: "name", "full name": "name", නම: "name", "සම්පූර්ණ නම": "name",
  school: "school", පාසල: "school",
  grade: "grade", class: "grade", ශ්‍රේණිය: "grade",
  medium: "medium", language: "medium", මාධ්‍යය: "medium",
  phone: "phone", mobile: "phone", tel: "phone", දුරකතනය: "phone", "දුරකථන අංකය": "phone",
  email: "email", "e-mail": "email", mail: "email",
  alyear: "alYear", "al year": "alYear", al_year: "alYear", "උසස් පෙළ වර්ෂය": "alYear",
  institute: "institute", ආයතනය: "institute",
};

export function normalizeGrade(v: string): string {
  const s = v.trim().toLowerCase();
  if (/^(a\/?l|උසස්\s*පෙළ|advanced)/.test(s)) return String(AL_GRADE);
  const m = s.match(/\d+/);
  return m && (GRADES as readonly number[]).includes(Number(m[0])) ? m[0] : v.trim();
}

export function normalizeMedium(v: string): string {
  const s = v.trim().toLowerCase();
  if (["sinhala", "si", "sin", "සිංහල", "සිංහල මාධ්‍ය", "සිංහල මාධ්‍යය"].includes(s)) return "SINHALA";
  if (["english", "en", "eng", "ඉංග්‍රීසි", "english medium"].includes(s)) return "ENGLISH";
  return v.trim();
}

// CSV පෙළ → පේළි (තීරු නාම හඳුනා ගෙන). වලංගු නොවන header එකක් නම් error
export function readImportCsv(text: string): { rows: ImportRow[]; error?: "empty" | "missing"; missing?: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: "empty" };
  const map = table[0].map((h) => HEADERS[h.trim().toLowerCase().replace(/\s+/g, " ")] ?? null);
  const need = ["name", "school", "grade", "medium", "phone", "email"] as const;
  const missing = need.filter((k) => !map.includes(k));
  if (missing.length) return { rows: [], error: "missing", missing: [...missing] };
  const rows: ImportRow[] = table.slice(1).map((cells, i) => {
    const r: ImportRow = { line: i + 2, name: "", school: "", grade: "", medium: "", phone: "", email: "", alYear: "", institute: "" };
    cells.forEach((c, idx) => {
      const k = map[idx];
      if (k) r[k] = c;
    });
    r.grade = normalizeGrade(r.grade);
    r.medium = normalizeMedium(r.medium);
    return r;
  });
  return { rows };
}

export const IMPORT_TEMPLATE = "name,school,grade,medium,phone,email,al_year,institute\nKamal Perera,Royal College,10,SINHALA,0771234567,kamal@example.com,,\nNimali Silva,Visakha Vidyalaya,12,ENGLISH,0712345678,nimali@example.com,2027,\n";

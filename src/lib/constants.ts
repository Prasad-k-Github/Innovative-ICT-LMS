import type { T } from "./i18n/core";

export const APP_NAME = "Innovative ICT";

// ICT විෂය උගන්වන ශ්‍රේණි. "12" යනු උසස් පෙළ (A/L) සඳහා වෙන් කළ කේතයයි
// (12 සහ 13 වෙන් නොකර, සිසුවා ලියාපදිංචියේදී විභාග වර්ෂය ලබා දෙයි).
export const AL_GRADE = 12;
export const GRADES = [6, 7, 8, 9, 10, 11, AL_GRADE] as const;

export function gradeLabel(grade: number, alYear?: number | null, t: T = (k, v) => k.replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? ""))) {
  if (grade === AL_GRADE) return alYear ? t("උසස් පෙළ {year}", { year: alYear }) : t("උසස් පෙළ (A/L)");
  return t("{n} ශ්‍රේණිය", { n: grade });
}

// A/L විභාගයට පෙනී සිටින වර්ෂය (මෙම වර්ෂයේ සිට වසර 4ක් ඉදිරියට)
export function alExamYears() {
  const y = new Date().getFullYear();
  return [y, y + 1, y + 2, y + 3, y + 4];
}

export const CONTENT_TYPE_LABELS = {
  TEXTBOOK: "පෙළපොත",
  WORKBOOK: "වැඩපොත",
  TUTE: "Tute",
  ESSAY: "නිබන්ධන",
  PAST_PAPER: "Past Papers",
  MODEL_PAPER: "Model Papers",
  RECORDING: "Recordings",
  NOTE: "අමතර Notes",
} as const;
export type ContentType = keyof typeof CONTENT_TYPE_LABELS;

// පාඩමකට අයත් අන්තර්ගත වර්ග (පාඩම් කාඩ් එක තුළ පෙන්වන අනුපිළිවෙල)
// (Tute, Notes, පාඩම අනුව Past Papers සහ Model Papers ද ඇතුළත්)
export const LESSON_TYPES: ContentType[] = ["TEXTBOOK", "WORKBOOK", "TUTE", "ESSAY", "NOTE", "RECORDING", "PAST_PAPER", "MODEL_PAPER"];
// සිසුවාගේ පාඩම් පිටුවේ කොටස් පෙන්වන අනුපිළිවෙල
export const LESSON_PAGE_ORDER: ContentType[] = ["TUTE", "NOTE", "PAST_PAPER", "MODEL_PAPER", "TEXTBOOK", "WORKBOOK", "ESSAY", "RECORDING"];
// පාඩමකට සම්බන්ධ නොවන, ශ්‍රේණිය සඳහා පොදු අන්තර්ගතය
export const GENERAL_TYPES: ContentType[] = ["PAST_PAPER", "MODEL_PAPER", "RECORDING", "NOTE"];

// Admin ට එක් කළ හැක්කේ Google Drive / Docs links පමණි
export const ALLOWED_LINK_HOSTS = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];

// සිසුන් උඩුගත කරන files (database එකේ ගබඩා වේ; Vercel request සීමාව 4.5MB නිසා 4MB)
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const UPLOAD_MAX_FILES = 5; // එක් පැවරුමකට
export const UPLOAD_MAX_TOTAL_BYTES = 15 * 1024 * 1024; // එක් පැවරුමකට සම්පූර්ණ
// ඉඩ දෙන file වර්ග (දිගුව → MIME). Download කරන විට MIME එක මෙතැනින් පමණක් තීරණය වේ.
export const UPLOAD_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain; charset=utf-8",
  zip: "application/zip",
  accdb: "application/octet-stream",
};
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES).map((e) => "." + e).join(",");
export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 6;

export const SESSION_COOKIE = "ict_session";
export const SESSION_DAYS = 7;
export const VERIFY_TOKEN_HOURS = 24;
export const RESET_TOKEN_HOURS = 1;
export const SETUP_TOKEN_HOURS = 24; // Email තහවුරු කළ පසු "මුරපදය සාදන්න" තිරය සඳහා
export const INVITE_TOKEN_HOURS = 72; // Admin සාදන සිසුන්ට යවන "මුරපදය සකසන්න" link එක
export const PAGE_SIZE = 20;
export const ADMIN_MIN_PASSWORD = 10; // Admin / Super Admin මුරපදවල අවම දිග

// පන්ති පවත්වන ස්ථාන (ආයතන). Seed script එක සහ landing page එක මෙය භාවිතා කරයි.
export const CLASS_LOCATIONS = [
  { name: "Pawara - Udugama", place: "උඩුගම", grades: "6 - A/L", medium: "සිංහල මාධ්‍ය" },
  { name: "Neth - Mapalagama", place: "මාපලගම", grades: "6 - A/L", medium: "සිංහල මාධ්‍ය" },
  { name: "Widumina - Neluwa", place: "නෑලුව", grades: "O/L සහ A/L", medium: "සිංහල මාධ්‍ය" },
  { name: "Sarasavi - Manawila", place: "මානාවිල", grades: "6 - O/L", medium: "English Medium" },
  { name: "Online", place: "අන්තර්ජාලය", grades: "6 - A/L", medium: "සිංහල සහ English" },
] as const;

export const MEDIUMS = ["SINHALA", "ENGLISH"] as const;
export const MEDIUM_LABELS = { SINHALA: "සිංහල මාධ්‍ය", ENGLISH: "English Medium" } as const;

// Landing page එකේ ඡායාරූපය යටින් පෙන්වන තොරතුරු (මෙතැනින් වෙනස් කරන්න)
export const TEACHER = {
  name: "Thilina Prasad Kaushalya",
  title: "ICT ගුරුවරයා",
  details: ["Software Engineer", "Higher National Diploma in Software Engineering (NIBM)"],
} as const;

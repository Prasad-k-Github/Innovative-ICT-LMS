import { csvDate, csvResponse } from "@/lib/csv";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { loadProgress } from "@/lib/progress";
import { parseProgressFilters } from "@/lib/progress-filters";
import { getCurrentUser, isAdminUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// ප්‍රගති / නිෂ්ක්‍රීය සිසුන්ගේ වාර්තාව CSV ලෙස
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) return new Response("Forbidden", { status: 403 });
  const t = await getT();
  const f = parseProgressFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await loadProgress(f);
  const header = ["Index අංකය", "නම", "ශ්‍රේණිය", "මාධ්‍යය", "දුරකතනය", "පාඩම් බැලූ", "මුළු පාඩම්", "Quiz සම්පූර්ණ", "මුළු Quiz", "Quiz සාමාන්‍ය %", "පැවරුම් ඉදිරිපත් කළ", "මුළු පැවරුම්", "අවසන් ක්‍රියාකාරකම", "නිෂ්ක්‍රීයද"].map((h) => t(h));
  return csvResponse(
    header,
    rows.map((r) => [
      r.indexNo ?? "",
      r.name,
      gradeLabel(r.grade, r.alYear, t),
      r.medium ? t(MEDIUM_LABELS[r.medium]) : "",
      r.phone,
      r.lessonsViewed,
      r.lessonsTotal,
      r.quizzesDone,
      r.quizzesTotal,
      r.quizPct ?? "",
      r.asgDone,
      r.asgTotal,
      csvDate(r.lastActivity),
      r.inactive ? t("ඔව්") : t("නැත"),
    ]),
    `progress-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

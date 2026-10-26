import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, StatCard } from "@/components/cards";
import { EmptyState, PageHero, heroBtn } from "@/components/page-hero";
import { inputClass } from "@/components/ui";
import { GRADES, MEDIUMS, MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getLang, getT } from "@/lib/i18n/server";
import { INACTIVE_DAYS, WEAK_PCT, loadProgress, weakQuizzes } from "@/lib/progress";
import { parseProgressFilters } from "@/lib/progress-filters";
import { requireAdmin } from "@/lib/session";
import { DATE_LOCALE } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ප්‍රගතිය") };
}

function Bar({ value, total, tone }: { value: number; total: number; tone: string }) {
  const w = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${w}%` }} />
    </span>
  );
}

// සිසුන්ගේ ප්‍රගතිය සහ "මෙම සතියේ නිෂ්ක්‍රීය ළමුන්" වාර්තාව
export default async function AdminProgressPage(props: PageProps<"/admin/progress">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const f = parseProgressFilters(await props.searchParams);
  const [all, weak] = await Promise.all([loadProgress({ grade: f.grade, medium: f.medium }), weakQuizzes(f)]);
  const rows = f.inactiveOnly ? all.filter((r) => r.inactive) : all;
  const inactiveCount = all.filter((r) => r.inactive).length;
  const withQuiz = all.filter((r) => r.quizPct !== null);
  const avg = withQuiz.length ? Math.round(withQuiz.reduce((n, r) => n + (r.quizPct ?? 0), 0) / withQuiz.length) : null;
  const qs = new URLSearchParams();
  if (f.grade) qs.set("grade", String(f.grade));
  if (f.medium) qs.set("medium", f.medium);
  if (f.inactiveOnly) qs.set("view", "inactive");
  const exportHref = `/admin/progress/export${qs.size ? `?${qs}` : ""}`;
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" }) : t("කිසිවිටක නැත"));

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="activity"
        title={t("ප්‍රගතිය")}
        subtitle={t("සිසුන් පාඩම්, Quiz සහ පැවරුම් භාවිතා කරන ආකාරය. දින {n}ක් කිසිවක් නොකළ සිසුන් නිෂ්ක්‍රීය ලෙස සලකයි.", { n: INACTIVE_DAYS })}
        actions={
          <a href={exportHref} className={heroBtn} data-testid="progress-export">
            {t("CSV බාගන්න")}
          </a>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon="users" tone="blue" value={all.length} label={t("සක්‍රිය සිසුන්")} />
        <StatCard icon="bell" tone="red" value={inactiveCount} label={t("මෙම සතියේ නිෂ්ක්‍රීය")} href={`/admin/progress?${new URLSearchParams({ ...(f.grade ? { grade: String(f.grade) } : {}), ...(f.medium ? { medium: f.medium } : {}), view: "inactive" })}`} />
        <div className="col-span-2 lg:col-span-1">
          <StatCard icon="quiz" tone="green" value={avg === null ? "—" : `${avg}%`} label={t("Quiz සාමාන්‍ය ලකුණු")} />
        </div>
      </div>

      <form method="get" className="grid gap-3 card p-4 sm:grid-cols-4">
        <select name="grade" defaultValue={f.grade ? String(f.grade) : ""} aria-label={t("ශ්‍රේණිය")} className={inputClass}>
          <option value="">{t("සියලු ශ්‍රේණි")}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {gradeLabel(g, null, t)}
            </option>
          ))}
        </select>
        <select name="medium" defaultValue={f.medium ?? ""} aria-label={t("මාධ්‍යය")} className={inputClass}>
          <option value="">{t("සියලු මාධ්‍ය")}</option>
          {MEDIUMS.map((m) => (
            <option key={m} value={m}>
              {t(MEDIUM_LABELS[m])}
            </option>
          ))}
        </select>
        <select name="view" defaultValue={f.view} aria-label={t("පෙන්වන්න")} className={inputClass}>
          <option value="all">{t("සියලු සිසුන්")}</option>
          <option value="inactive">{t("නිෂ්ක්‍රීය සිසුන් පමණි")}</option>
        </select>
        <button type="submit" className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
          {t("පෙන්වන්න")}
        </button>
      </form>

      {weak.length > 0 && (
        <section className="card space-y-3 p-5" data-testid="weak-quizzes">
          <h2 className="font-display text-lg font-bold text-navy">{t("පන්තියට අපහසු Quiz")}</h2>
          <ul className="space-y-2 text-sm">
            {weak.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/quizzes/${w.id}`} className="font-semibold text-primary hover:underline">
                  {w.title}
                </Link>
                <span className="text-muted">
                  {gradeLabel(w.grade, null, t)} · {t("උත්සාහ {n}", { n: w.attempts })} · <b className="text-accent">{w.avgPct}%</b>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyState icon="users">{f.inactiveOnly ? t("නිෂ්ක්‍රීය සිසුන් නැත. 🎉") : t("සක්‍රිය සිසුන් නැත.")}</EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="progress-list">
          {rows.map((r) => (
            <li key={r.id} data-student={r.id} data-inactive={r.inactive ? "1" : "0"}>
              <Link href={`/admin/students/${r.id}?tab=progress`} className="card block space-y-3 p-4 transition hover:border-primary/50">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} src={null} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{r.name}</p>
                    <p className="text-xs text-muted">
                      {gradeLabel(r.grade, r.alYear, t)} · {r.medium ? t(MEDIUM_LABELS[r.medium]) : ""} {r.indexNo ? `· ${r.indexNo}` : ""}
                    </p>
                  </div>
                  {r.inactive && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">{t("නිෂ්ක්‍රීය")}</span>}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-muted">
                  <div>
                    <span className="font-semibold text-navy">{t("පාඩම්")}</span> {r.lessonsViewed}/{r.lessonsTotal}
                    <Bar value={r.lessonsViewed} total={r.lessonsTotal} tone="bg-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-navy">Quiz</span> {r.quizzesDone}/{r.quizzesTotal}
                    {r.quizPct !== null && (
                      <b className={`ml-1 ${r.quizPct < WEAK_PCT ? "text-accent" : "text-emerald-700"}`}>{r.quizPct}%</b>
                    )}
                    <Bar value={r.quizzesDone} total={r.quizzesTotal} tone="bg-emerald-500" />
                  </div>
                  <div>
                    <span className="font-semibold text-navy">{t("පැවරුම්")}</span> {r.asgDone}/{r.asgTotal}
                    <Bar value={r.asgDone} total={r.asgTotal} tone="bg-amber-500" />
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {t("අවසන් ක්‍රියාකාරකම")}: {fmt(r.lastActivity)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

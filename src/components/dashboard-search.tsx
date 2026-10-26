import Link from "next/link";
import { Icon } from "@/components/icons";
import { Alert, inputClass } from "@/components/ui";
import { CONTENT_TYPE_LABELS, gradeGroup, gradeLabel, type ContentType } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import type { SessionUser } from "@/lib/session";
import { SEARCH_SORTS, SEARCH_TYPES, searchActive, searchStudentContent, type SearchParams } from "@/lib/student-search";

const TYPE_LABEL: Record<(typeof SEARCH_TYPES)[number], string> = {
  all: "සියල්ල",
  LESSON: "පාඩම්",
  TUTE: "Tutes",
  PAST_PAPER: "Past Papers",
  MODEL_PAPER: "Model Papers",
  NOTE: "අමතර Notes",
  RECORDING: "Recordings",
  TEXTBOOK: "පෙළපොත",
  WORKBOOK: "වැඩපොත",
  ESSAY: "නිබන්ධන",
  QUIZ: "Quiz",
  ASSIGNMENT: "පැවරුම්",
};
const SORT_LABEL = { relevance: "පෙරනිමි", newest: "අලුත්ම", title: "නම අනුව" } as const;
const ICON = { LESSON: "book", TUTE: "layers", FILE: "papers", QUIZ: "quiz", ASSIGNMENT: "clipboard" } as const;

// Dashboard සෙවුම: පාඩම්, Tutes, Papers, Notes, Recordings, Quiz, පැවරුම් සහ උසස් පෙරහන් (වර්ගය, ශ්‍රේණිය, වර්ෂය, අනුපිළිවෙල)
export async function DashboardSearch({ user, params }: { user: SessionUser; params: SearchParams }) {
  const t = await getT();
  const items = await searchStudentContent(user, params);
  const active = searchActive(params);
  const group = gradeGroup(user.grade);
  const advancedOpen = params.type !== "all" || params.grade !== null || params.year !== null || params.sort !== "relevance";
  const years = Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => new Date().getFullYear() - i);
  const sel = `${inputClass} min-h-11`;

  return (
    <section id="search" className="space-y-4" data-testid="dashboard-search">
      <form method="get" action="/dashboard#search" role="search" className="card space-y-3 p-4 sm:p-5">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            maxLength={60}
            autoComplete="off"
            aria-label={t("පාඩම්, Tutes, Papers, Quiz සොයන්න")}
            placeholder={t("පාඩම්, Tutes, Papers, Quiz සොයන්න")}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
            <Icon name="search" className="h-5 w-5" />
            {t("සොයන්න")}
          </button>
        </div>
        <details open={advancedOpen} data-testid="search-advanced">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">{t("උසස් පෙරහන්")}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm font-semibold text-navy">
              {t("වර්ගය")}
              <select name="type" defaultValue={params.type} className={sel}>
                {SEARCH_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(TYPE_LABEL[x])}
                  </option>
                ))}
              </select>
            </label>
            {group.length > 1 && (
              <label className="space-y-1 text-sm font-semibold text-navy">
                {t("ශ්‍රේණිය")}
                <select name="sg" defaultValue={params.grade ? String(params.grade) : ""} className={sel}>
                  <option value="">{t("සියලු ශ්‍රේණි")}</option>
                  {group.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g, null, t)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="space-y-1 text-sm font-semibold text-navy">
              {t("වර්ෂය (Papers)")}
              <select name="year" defaultValue={params.year ? String(params.year) : ""} className={sel}>
                <option value="">{t("ඕනෑම වර්ෂයක්")}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold text-navy">
              {t("අනුපිළිවෙල")}
              <select name="sort" defaultValue={params.sort} className={sel}>
                {SEARCH_SORTS.map((x) => (
                  <option key={x} value={x}>
                    {t(SORT_LABEL[x])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              data-testid="search-apply-filters"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Icon name="filter" className="h-4 w-4" />
              {t("පෙරහන් යොදන්න")}
            </button>
            {advancedOpen && (
              <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline">
                {t("පෙරහන් ඉවත් කරන්න")}
              </Link>
            )}
          </div>
        </details>
      </form>
      {params.q.length > 0 && params.q.length < 2 && <Alert kind="info">{t("අකුරු 2ක් හෝ වැඩි ගණනක් ටයිප් කරන්න.")}</Alert>}
      {active && user.medium && !(params.q.length > 0 && params.q.length < 2) && (
        <p className="text-sm font-semibold text-navy" data-testid="search-count">
          {t("ප්‍රතිඵල {n}", { n: items.length })}
        </p>
      )}
      {active && user.medium && items.length === 0 && !(params.q.length > 0 && params.q.length < 2) && (
        <p className="card p-5 text-center text-muted">{t("ප්‍රතිඵල නැත.")}</p>
      )}
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="search-results">
          {items.map((i) => {
            const shared = group.length > 1;
            const label =
              i.kind === "FILE" ? t(CONTENT_TYPE_LABELS[i.fileType as ContentType]) + (i.year ? ` ${i.year}` : "") : i.kind === "TUTE" ? t("Tutes") : i.kind === "LESSON" ? t("පාඩම {n}", { n: i.order ?? 0 }) : i.kind === "QUIZ" ? "Quiz" : t("පැවරුම්");
            return (
              <li key={i.key}>
                <Link href={i.href} className="card group flex min-h-16 items-center gap-3.5 p-3.5 transition hover:-translate-y-0.5 hover:border-primary/50">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon name={ICON[i.kind]} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy">{i.title}</span>
                    <span className="text-xs text-muted">{`${shared ? `${gradeLabel(i.grade, null, t)} · ` : ""}${label}`}</span>
                  </span>
                  <Icon name="arrow" className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

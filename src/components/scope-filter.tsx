import { GRADES, MEDIUMS, MEDIUM_LABELS, gradeGroup, gradeLabel } from "@/lib/constants";
import type { T } from "@/lib/i18n/core";
import { inputClass } from "./ui";

// ශ්‍රේණිය සහ මාධ්‍යය තේරීමේ GET form එක
export function ScopeFilter({ grade, medium, action, t }: { grade: number; medium: string; action: string; t: T }) {
  return (
    <form method="get" action={action} className="grid gap-3 card p-4 sm:grid-cols-3">
      <select name="grade" defaultValue={String(grade)} aria-label={t("ශ්‍රේණිය")} className={inputClass}>
        {GRADES.map((g) => (
          <option key={g} value={g}>
            {gradeLabel(g, null, t)}
          </option>
        ))}
      </select>
      <select name="medium" defaultValue={medium} aria-label={t("මාධ්‍යය")} className={inputClass}>
        {MEDIUMS.map((m) => (
          <option key={m} value={m}>
            {t(MEDIUM_LABELS[m])}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
        {t("පෙන්වන්න")}
      </button>
      {gradeGroup(grade).length > 1 && (
        <p className="text-sm text-muted sm:col-span-3" data-testid="shared-grade-note">
          {t("{a} සහ {b} ශ්‍රේණි සිසුන්ට එකිනෙකාගේ අන්තර්ගතය පෙනේ. මෙහි එක් කරන දේ දෙපිරිසටම පෙන්වයි.", { a: gradeGroup(grade)[0], b: gradeGroup(grade)[1] })}
        </p>
      )}
    </form>
  );
}

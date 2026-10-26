"use client";

import { useActionState } from "react";
import Link from "next/link";
import { promoteStudentsAction } from "@/app/actions/admin";
import { alExamYears, gradeLabel, MEDIUMS, MEDIUM_LABELS } from "@/lib/constants";
import { PROMOTABLE_GRADES, type PromoteState } from "@/lib/promotion";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, inputClass } from "./ui";

// Super Admin: වර්ෂාවසානයේ ශ්‍රේණි උසස් කිරීම (1. පෙරදසුන, 2. PROMOTE ටයිප් කර තහවුරු කිරීම)
export function PromoteForm() {
  const t = useT();
  const [state, previewAction] = useActionState(async (prev: PromoteState, fd: FormData) => promoteStudentsAction(prev, fd), {} as PromoteState);
  const [final, promoteAction] = useActionState(async (prev: PromoteState, fd: FormData) => promoteStudentsAction(prev, fd), {} as PromoteState);
  const pv = final.preview ?? state.preview;
  const done = final.done;

  if (done) {
    return (
      <section className="space-y-3" data-testid="promote-done">
        <Alert kind="success">{t("සිසුන් {n}ක් ඊළඟ ශ්‍රේණියට උසස් කරන ලදී.", { n: done.count })}</Alert>
        <ul className="card divide-y divide-line text-sm">
          {Object.entries(done.byGrade).map(([g, n]) => (
            <li key={g} className="flex justify-between p-3">
              <span>
                {gradeLabel(Number(g), null, t)} → {Number(g) === 11 ? t("උසස් පෙළ (A/L)") : gradeLabel(Number(g) + 1, null, t)}
              </span>
              <b>{n}</b>
            </li>
          ))}
        </ul>
        <Link href="/admin/students" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
          ← {t("සිසුන්")}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <form action={previewAction} className="card space-y-5 p-5 sm:p-6" data-testid="promote-form">
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-navy">{t("උසස් කළ යුතු ශ්‍රේණි")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROMOTABLE_GRADES.map((g) => (
              <label key={g} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm">
                <input type="checkbox" name="g" value={g} defaultChecked className="h-5 w-5 accent-primary" />
                {gradeLabel(g, null, t)} → {g === 11 ? t("A/L") : g + 1}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="medium" className="text-sm font-semibold text-navy">
              {t("මාධ්‍යය")}
            </label>
            <select id="medium" name="medium" className={inputClass} defaultValue="">
              <option value="">{t("සියලු මාධ්‍ය")}</option>
              {MEDIUMS.map((m) => (
                <option key={m} value={m}>
                  {t(MEDIUM_LABELS[m])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="alYear" className="text-sm font-semibold text-navy">
              {t("11 ශ්‍රේණියේ සිසුන්ගේ A/L විභාග වර්ෂය")}
            </label>
            <select id="alYear" name="alYear" className={inputClass} defaultValue="">
              <option value="">{t("වර්ෂය තෝරන්න")}</option>
              {alExamYears().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">{t("10 සහ 11 ශ්‍රේණි අන්තර්ගතය බෙදාගන්නා නිසා, එම සිසුන් උසස් කළ පසුත් O/L අන්තර්ගතය දෙකම දකිති. උසස් පෙළ සිසුන් උසස් නොකෙරේ.")}</p>
        <input type="hidden" name="intent" value="preview" />
        <SubmitButton>{t("පෙරදසුන බලන්න")}</SubmitButton>
      </form>

      {pv && (
        <section className="card space-y-4 p-5 sm:p-6" data-testid="promote-preview">
          <h2 className="font-display text-lg font-bold text-navy">{t("පෙරදසුන")}</h2>
          <ul className="divide-y divide-line text-sm">
            {pv.grades.map((g) => (
              <li key={g} className="flex justify-between py-2" data-grade-row={g}>
                <span>
                  {gradeLabel(g, null, t)} → {g === 11 ? `${t("උසස් පෙළ (A/L)")} ${pv.alYear}` : gradeLabel(g + 1, null, t)}
                </span>
                <b>{pv.byGrade[g] ?? 0}</b>
              </li>
            ))}
            <li className="flex justify-between py-2 font-bold">
              <span>{t("එකතුව")}</span>
              <span data-testid="promote-total">{pv.total}</span>
            </li>
          </ul>
          <Alert kind="warning">{t("මෙය සියලු තෝරාගත් සිසුන්ට එකවර බලපායි. පළමුව සිසුන් CSV එකක් බාගත කර ගන්න.")}</Alert>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ෆයිල් බාගැනීමකි (route handler) */}
          <a href="/admin/students/export" className="inline-flex min-h-11 items-center font-semibold text-primary underline">
            {t("සිසුන් CSV බාගන්න (උසස් කිරීමට පෙර)")}
          </a>
          {pv.total > 0 && (
            <form action={promoteAction} className="space-y-3" data-testid="promote-confirm">
              {final.error && <Alert kind="error">{final.error}</Alert>}
              <input type="hidden" name="intent" value="promote" />
              {pv.grades.map((g) => (
                <input key={g} type="hidden" name="g" value={g} />
              ))}
              <input type="hidden" name="medium" value={pv.medium} />
              <input type="hidden" name="alYear" value={pv.alYear} />
              <label htmlFor="confirm" className="block text-sm font-semibold text-navy">
                {t("තහවුරු කිරීමට PROMOTE ලෙස ටයිප් කරන්න.")}
              </label>
              <input id="confirm" name="confirm" autoComplete="off" className={inputClass} placeholder="PROMOTE" />
              <SubmitButton pendingText="උසස් කරමින්...">{t("සිසුන් {n}ක් උසස් කරන්න", { n: pv.total })}</SubmitButton>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { importStudentsAction } from "@/app/actions/admin";
import type { ImportState } from "@/lib/student-import";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { CredentialsTable } from "./temp-credentials";
import { Alert, inputClass } from "./ui";

// Admin: CSV එකකින් සිසුන් එකවර import කිරීම (1. පෙරදසුන, 2. තහවුරු කර import)
export function StudentImportForm({ institutes, maxRows }: { institutes: { id: string; name: string }[]; maxRows: number }) {
  const t = useT();
  const [state, previewAction] = useActionState(async (prev: ImportState, fd: FormData) => importStudentsAction(prev, fd), {} as ImportState);
  const [final, importAction] = useActionState(async (prev: ImportState, fd: FormData) => importStudentsAction(prev, fd), {} as ImportState);
  const pv = state.preview;
  const done = final.done;

  return (
    <div className="space-y-6">
      {!done && (
        <form action={previewAction} className="card space-y-4 p-5 sm:p-6" data-testid="import-form">
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="space-y-1.5">
            <label htmlFor="file" className="text-sm font-semibold text-navy">
              {t("CSV file එක")}
            </label>
            <input id="file" name="file" type="file" accept=".csv,text/csv,text/plain" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="csv" className="text-sm font-semibold text-navy">
              {t("හෝ CSV පෙළ මෙතැන අලවන්න")}
            </label>
            <textarea id="csv" name="csv" rows={6} className={`${inputClass} font-mono text-xs`} placeholder="name,school,grade,medium,phone,email,parent_phone" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="instituteId" className="text-sm font-semibold text-navy">
              {t("පෙරනිමි ආයතනය")}
            </label>
            <select id="instituteId" name="instituteId" className={inputClass} defaultValue={institutes[0]?.id}>
              {institutes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted">{t("එක් වරකට උපරිම සිසුන් {n}ක්.", { n: maxRows })}</p>
          <input type="hidden" name="intent" value="preview" />
          <SubmitButton>{t("පෙරදසුන බලන්න")}</SubmitButton>
        </form>
      )}

      {pv && !done && (
        <section className="space-y-4" data-testid="import-preview">
          <Alert kind={pv.okCount > 0 ? "info" : "warning"}>
            {t("වලංගු පේළි {ok} / {all}. වැරදි පේළි import නොකෙරේ.", { ok: pv.okCount, all: pv.rows.length })}
          </Alert>
          <ul className="card divide-y divide-line text-sm">
            {pv.rows.map((r) => (
              <li key={r.line} data-row={r.line} data-ok={r.ok ? "1" : "0"} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="font-semibold text-navy">{r.name || "—"}</span> <span className="text-muted">{r.email}</span>
                  {!r.ok && <span className="mt-1 block text-xs text-accent">{r.errors.join(" · ")}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${r.ok ? "bg-emerald-100 text-emerald-800" : "bg-accent-soft text-accent"}`}>
                  {t("පේළිය")} {r.line} · {r.ok ? "✓" : "✗"}
                </span>
              </li>
            ))}
          </ul>
          {pv.okCount > 0 && (
            <form action={importAction} data-testid="import-confirm">
              <input type="hidden" name="intent" value="import" />
              <input type="hidden" name="csv" value={pv.csv} />
              <input type="hidden" name="instituteId" value={pv.instituteId} />
              {final.error && <Alert kind="error">{final.error}</Alert>}
              <SubmitButton pendingText="Import කරමින්...">{t("සිසුන් {n}ක් import කරන්න", { n: pv.okCount })}</SubmitButton>
            </form>
          )}
        </section>
      )}

      {done && (
        <section className="space-y-4" data-testid="import-done">
          <Alert kind="success">{t("සිසුන් {n}ක් සාර්ථකව import කරන ලදී.", { n: done.created })}</Alert>
          {done.credentials.length > 0 && <CredentialsTable list={done.credentials} expires={done.expires} />}
          {done.failed.length > 0 && (
            <ul className="card divide-y divide-line text-sm" data-testid="import-failed">
              {done.failed.map((r) => (
                <li key={r.line} className="p-3">
                  <span className="font-semibold text-navy">{r.name || "—"}</span> <span className="text-muted">{r.email}</span>
                  <span className="mt-1 block text-xs text-accent">
                    {t("පේළිය")} {r.line}: {r.errors.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

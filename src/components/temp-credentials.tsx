"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resetTempPasswordAction } from "@/app/actions/admin";
import { csvCell } from "@/lib/csv";
import type { FormState, TempCredential } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, btnSecondary } from "./ui";

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }, () => {});
      }}
      className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-primary-soft"
    >
      {done ? t("පිටපත් කළා") : label}
    </button>
  );
}

// Admin ට එක් වරක් පමණක් පෙන්වන තාවකාලික මුරපදය (පද්ධතියේ ගබඩා වන්නේ hash පමණි)
export function CredentialCard({ c, children }: { c: TempCredential; children?: React.ReactNode }) {
  const t = useT();
  const message = `${t("Innovative ICT ගිණුම")}\n${t("Index අංකය")}: ${c.indexNo}\nEmail: ${c.email}\n${t("තාවකාලික මුරපදය")}: ${c.password}\n${t("වලංගු කාලය")}: ${c.expires}`;
  return (
    <section className="space-y-4 card p-5 sm:p-6" data-testid="credential-card">
      <Alert kind="warning">{t("මෙම තාවකාලික මුරපදය දැන් පමණක් පෙන්වයි. නැවත බැලීමට නොහැක (අවශ්‍ය නම් අලුත් එකක් ජනනය කරන්න). එය සිසුවාට පමණක් ලබා දෙන්න; Email කර නැත.")}</Alert>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">{t("සිසුවා")}</dt><dd className="font-semibold text-navy">{c.name}</dd></div>
        <div><dt className="text-muted">{t("Index අංකය")}</dt><dd className="font-mono font-semibold text-navy" data-testid="cred-index">{c.indexNo}</dd></div>
        <div><dt className="text-muted">Email</dt><dd className="break-all font-semibold text-navy">{c.email}</dd></div>
        <div><dt className="text-muted">{t("වලංගු කාලය")}</dt><dd className="font-semibold text-navy">{c.expires}</dd></div>
      </dl>
      <div className="rounded-2xl bg-primary-soft p-4 text-center">
        <p className="text-sm text-muted">{t("තාවකාලික මුරපදය")}</p>
        <p className="mt-1 select-all font-mono text-3xl font-bold tracking-widest text-navy" data-testid="cred-password">{c.password}</p>
      </div>
      <p className="text-sm text-muted">{t("සිසුවා Index අංකයෙන් (හෝ Email) සහ මෙම මුරපදයෙන් login වී, තමාගේ මුරපදය සාදා, Email තහවුරු කර, එකඟත්වයන් ලබා දිය යුතුයි.")}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={message} label={t("විස්තර පිටපත් කරන්න")} />
        {children}
      </div>
    </section>
  );
}

export function CredentialsTable({ list, expires }: { list: TempCredential[]; expires: string }) {
  const t = useT();
  function download() {
    const header = ["Index No", "Name", "Email", "Temporary password", "Valid until"];
    const lines = [header, ...list.map((c) => [c.indexNo, c.name, c.email, c.password, expires])].map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "temporary-passwords.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="space-y-3" data-testid="credentials-table">
      <Alert kind="warning">{t("තාවකාලික මුරපද දැන් පමණක් පෙන්වයි. CSV එක බාගෙන ආරක්ෂිතව තබා සිසුන්ට ලබා දෙන්න (Email කර නැත). නැවත බැලීමට නොහැක; අවශ්‍ය නම් සිසුවාගේ පිටුවෙන් අලුත් එකක් ජනනය කරන්න.")}</Alert>
      <button type="button" onClick={download} data-testid="credentials-download" className={btnSecondary}>
        {t("තාවකාලික මුරපද CSV බාගන්න")}
      </button>
      <ul className="card divide-y divide-line text-sm">
        {list.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="min-w-0">
              <Link href={`/admin/students/${c.id}`} className="font-semibold text-primary hover:underline">{c.name}</Link>{" "}
              <span className="font-mono text-xs text-muted">{c.indexNo}</span>
            </span>
            <span className="font-mono font-bold tracking-wider text-navy">{c.password}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// සිසුවාගේ පිටුවේ: තාවකාලික මුරපදය නැවත ජනනය කිරීම
export function ResetTempPasswordPanel({ id }: { id: string }) {
  const t = useT();
  const [state, action] = useActionState(async (prev: FormState): Promise<FormState> => resetTempPasswordAction(id, prev), {} as FormState);
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4" data-testid="temp-reset-panel">
      <h3 className="font-semibold text-navy">{t("තාවකාලික මුරපදය (නැවත ජනනය)")}</h3>
      <p className="text-sm text-muted">{t("සිසුවා මුරපදය අමතක කළ විට හෝ තාවකාලික මුරපදය ඉකුත් වූ විට අලුත් එකක් ජනනය කරන්න. සියලු devices වල logout වේ; සිසුවා නැවත මුරපදය සාදා ගත යුතුයි.")}</p>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.credential && <CredentialCard c={state.credential} />}
      <form action={action}>
        <SubmitButton className={btnSecondary} pendingText="ජනනය කරමින්...">{t("අලුත් තාවකාලික මුරපදයක් ජනනය කරන්න")}</SubmitButton>
      </form>
    </div>
  );
}

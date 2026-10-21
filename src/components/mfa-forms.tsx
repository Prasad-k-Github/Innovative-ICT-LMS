"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { cancelMfaAction, verifyMfaAction } from "@/app/actions/auth";
import { confirmMfaAction, disableMfaAction, regenerateRecoveryAction } from "@/app/actions/security";
import type { FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, btnPrimary } from "./ui";

function useForm(action: (p: FormState, fd: FormData) => Promise<FormState>) {
  return useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({ ...(await action(prev, fd)), n: (prev.n ?? 0) + 1 }),
    {} as FormState,
  );
}

// Login: මුරපදයෙන් පසු 6-ඉලක්කම් code එක (හෝ recovery code)
export function MfaLoginForm() {
  const t = useT();
  const [state, formAction] = useForm(verifyMfaAction);
  return (
    <div className="space-y-4">
      <form key={state.n ?? 0} action={formAction} className="space-y-4" noValidate>
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <div>
          <Field
            label={t("සත්‍යාපන code එක")}
            name="code"
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="123456"
            error={state.fieldErrors?.code}
            hint={t("Authenticator app එකේ ඉලක්කම් 6ක code එක, නැතහොත් recovery code එකක් ඇතුළත් කරන්න.")}
          />
        </div>
        <SubmitButton pendingText="පරීක්ෂා කරමින්...">{t("තහවුරු කරන්න")}</SubmitButton>
      </form>
      <form action={cancelMfaAction}>
        <button type="submit" className="min-h-11 w-full text-sm font-semibold text-muted hover:text-ink">
          {t("අවලංගු කර නැවත login වන්න")}
        </button>
      </form>
    </div>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const t = useT();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border border-sun bg-sun-soft p-4" data-testid="recovery-codes">
      <p className="text-sm font-semibold text-navy">{t("Recovery codes — දැන්ම ආරක්ෂිත තැනක සුරකින්න. නැවත පෙන්වන්නේ නැත.")}</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-white px-3 py-2 text-center tracking-wider" data-recovery>
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true));
        }}
        className="min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50"
      >
        {copied ? t("පිටපත් කළා") : t("සියල්ල පිටපත් කරන්න")}
      </button>
      <button
        type="button"
        data-testid="codes-saved"
        onClick={() => router.refresh()}
        className="ml-2 min-h-10 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-950"
      >
        {t("මම මේවා සුරැකුවා")}
      </button>
      <p className="text-xs text-navy/70">{t("Authenticator app එක නැති වුවහොත් එක් code එකක් එක් වරක් පමණක් භාවිතා කළ හැක.")}</p>
    </div>
  );
}

export function MfaConfirmForm() {
  const t = useT();
  const [state, formAction] = useForm(confirmMfaAction);
  if (state.ok && state.codes) {
    return (
      <div className="space-y-3">
        <Alert kind="success">{state.message}</Alert>
        <RecoveryCodes codes={state.codes} />
      </div>
    );
  }
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label={t("Authenticator app එකේ code එක")}
        name="code"
        id="mfa-confirm-code"
        autoComplete="one-time-code"
        inputMode="numeric"
        placeholder="123456"
        error={state.fieldErrors?.code}
      />
      <SubmitButton pendingText="පරීක්ෂා කරමින්...">{t("සක්‍රිය කරන්න")}</SubmitButton>
    </form>
  );
}

export function MfaRegenForm() {
  const t = useT();
  const [state, formAction] = useForm(regenerateRecoveryAction);
  if (state.ok && state.codes) {
    return (
      <div className="space-y-3">
        <Alert kind="success">{state.message}</Alert>
        <RecoveryCodes codes={state.codes} />
      </div>
    );
  }
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label={t("මුරපදය")} name="password" id="mfa-regen-password" type="password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <SubmitButton pendingText="රැඳී සිටින්න..." className={`${btnPrimary} !bg-navy`}>
        {t("නව recovery codes සාදන්න")}
      </SubmitButton>
    </form>
  );
}

export function MfaDisableForm() {
  const t = useT();
  const [state, formAction] = useForm(disableMfaAction);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("මුරපදය")} name="password" id="mfa-disable-password" type="password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <Field label={t("වත්මන් code එක හෝ recovery code")} name="code" id="mfa-disable-code" autoComplete="one-time-code" error={state.fieldErrors?.code} />
      <SubmitButton pendingText="රැඳී සිටින්න..." className={`${btnPrimary} !bg-red-600 hover:!bg-red-700`}>
        {t("2-step අක්‍රිය කරන්න")}
      </SubmitButton>
    </form>
  );
}

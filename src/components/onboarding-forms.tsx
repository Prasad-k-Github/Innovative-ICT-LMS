"use client";

import { useActionState } from "react";
import {
  changeOnboardingEmailAction,
  confirmOnboardingEmailAction,
  saveOnboardingConsentAction,
  sendOnboardingCodeAction,
  setOnboardingPasswordAction,
} from "@/app/actions/onboarding";
import { emailCodeSchema, emailOnlySchema, onboardingConsentSchema, onboardingPasswordSchema, type FormState } from "@/lib/validators";
import { ConsentChecks, ParentContactFields } from "./consent-fields";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, btnSecondary } from "./ui";
import { useFormValidation } from "./use-form-validation";

const init: FormState = {};

/* (1) තමන්ගේ මුරපදය */
export function OnboardingPasswordForm() {
  const t = useT();
  const [state, action] = useActionState(setOnboardingPasswordAction, init);
  const { fe, formProps } = useFormValidation(onboardingPasswordSchema, state.fieldErrors);
  return (
    <form action={action} className="space-y-4" data-testid="onboarding-form" {...formProps}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label={t("නව මුරපදය")} name="password" type="password" autoComplete="new-password" hint={t("අවම වශයෙන් අක්ෂර 8ක්, අකුරු සහ ඉලක්කම් සහිතව")} error={fe?.password} />
      <Field label={t("නව මුරපදය නැවත ඇතුළත් කරන්න")} name="confirmPassword" type="password" autoComplete="new-password" error={fe?.confirmPassword} />
      <SubmitButton pendingText="සුරකිමින්...">{t("මුරපදය සුරකින්න")}</SubmitButton>
    </form>
  );
}

/* (2) Email තහවුරු කිරීම */
export function OnboardingEmailForm({ email }: { email: string }) {
  const t = useT();
  const [state, action] = useActionState(confirmOnboardingEmailAction, init);
  const [resend, resendAction, resending] = useActionState(async () => sendOnboardingCodeAction(), init);
  const [change, changeAction] = useActionState(changeOnboardingEmailAction, init);
  const { fe, formProps } = useFormValidation(emailCodeSchema.pick({ code: true }), state.fieldErrors);
  const ce = useFormValidation(emailOnlySchema, change.fieldErrors);
  return (
    <div className="space-y-5">
      <Alert kind="success">
        {t("ඉලක්කම් 6ක තහවුරු කිරීමේ code එකක් මෙම email ලිපිනයට යවා ඇත:")} <strong className="break-all">{email}</strong>
      </Alert>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {resend.error && <Alert kind="error">{resend.error}</Alert>}
      {resend.ok && <Alert kind="success">{resend.message}</Alert>}
      {change.error && <Alert kind="error">{change.error}</Alert>}
      {change.ok && <Alert kind="success">{change.message}</Alert>}

      <form action={action} className="space-y-4" data-testid="onboarding-form" {...formProps}>
        <Field label={t("තහවුරු කිරීමේ code එක")} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" defaultValue={state.values?.code} error={fe?.code} />
        <SubmitButton pendingText="තහවුරු කරමින්...">{t("තහවුරු කරන්න")}</SubmitButton>
      </form>

      <form action={resendAction} className="text-center">
        <p className="text-sm text-muted">{t("Code එක ලැබුණේ නැද්ද?")}</p>
        <button type="submit" disabled={resending} data-testid="onb-resend" className="mt-1 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:text-muted">
          {resending ? t("යවමින්...") : t("අලුත් code එකක් ඉල්ලන්න")}
        </button>
      </form>

      <details className="rounded-xl border border-line p-4">
        <summary className="min-h-8 cursor-pointer text-sm font-semibold text-ink">{t("Email ලිපිනය වැරදිද? නිවැරදි කරන්න")}</summary>
        <form action={changeAction} className="mt-3 space-y-3" data-testid="onb-change-form" {...ce.formProps}>
          <Field label={t("නිවැරදි Email ලිපිනය")} name="email" type="email" autoComplete="email" defaultValue={change.values?.email} error={ce.fe?.email} />
          <SubmitButton className={btnSecondary} pendingText="යවමින්...">{t("Email යාවත්කාලීන කර code එක යවන්න")}</SubmitButton>
        </form>
      </details>
    </div>
  );
}

/* (3) එකඟත්වයන් සහ දෙමාපිය විස්තර */
export function OnboardingConsentForm({ initial }: { initial: { parentPhone: string; parentEmail: string } }) {
  const [state, action] = useActionState(saveOnboardingConsentAction, init);
  const t = useT();
  const { fe, formProps } = useFormValidation(onboardingConsentSchema, state.fieldErrors);
  const v = { parentPhone: initial.parentPhone, parentEmail: initial.parentEmail, ...state.values };
  return (
    <form action={action} className="space-y-4" data-testid="onboarding-form" {...formProps}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <ParentContactFields fe={fe} v={v} />
      <ConsentChecks fe={fe} v={v} />
      <SubmitButton pendingText="සුරකිමින්...">{t("සුරකින්න සහ ඉදිරියට යන්න")}</SubmitButton>
    </form>
  );
}

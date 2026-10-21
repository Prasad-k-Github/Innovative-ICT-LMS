"use client";

import { useActionState } from "react";
import { adminUserSchema, ownNameSchema, type FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { useFormValidation } from "./use-form-validation";
import { SubmitButton } from "./submit-button";
import { Alert, Field } from "./ui";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function useKeyedForm(action: Action, initial: FormState) {
  return useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({
      ...(await action(prev, fd)),
      n: (prev.n ?? 0) + 1,
    }),
    initial,
  );
}

// Admin කෙනෙකු සෑදීම / සංස්කරණය (නම සහ email)
export function AdminUserForm({
  action,
  id,
  initial,
  submitLabel,
}: {
  action: Action;
  id?: string;
  initial?: { name: string; email: string };
  submitLabel: string;
}) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: initial } as FormState);
  const v = state.values ?? initial;
  const { fe, formProps } = useFormValidation(adminUserSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps}>
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("සම්පූර්ණ නම")} name="name" defaultValue={v?.name} error={fe?.name} autoComplete="off" />
      <Field label={t("Email ලිපිනය")} name="email" type="email" inputMode="email" defaultValue={v?.email} error={fe?.email} autoComplete="off" />
      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

// Admin ගේම නම (Email වෙනස් කළ හැක්කේ Super Admin ට පමණි)
export function OwnNameForm({ action, name }: { action: Action; name: string }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: { name } } as FormState);
  const { fe, formProps } = useFormValidation(ownNameSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("සම්පූර්ණ නම")} name="name" defaultValue={state.values?.name ?? name} error={fe?.name} />
      <SubmitButton pendingText="සුරකිමින්...">{t("සුරකින්න")}</SubmitButton>
    </form>
  );
}

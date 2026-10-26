"use client";

import { useActionState } from "react";
import { parentContactSchema, type FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { useFormValidation } from "./use-form-validation";
import { Alert, Field } from "./ui";

// දෙමාපිය/භාරකරුගේ සම්බන්ධතා සහ සතිපතා සාරාංශයට එකඟත්වය (සිසුවා සහ Admin දෙදෙනාටම)
export function ParentContactForm({
  action,
  initial,
  id,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: { parentEmail: string; parentPhone: string; parentOptIn: boolean };
  id?: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({ ...(await action(prev, fd)), n: (prev.n ?? 0) + 1 }),
    {} as FormState,
  );
  const v = state.values ?? { parentEmail: initial.parentEmail, parentPhone: initial.parentPhone, parentOptIn: initial.parentOptIn ? "on" : "" };
  const { fe, formProps } = useFormValidation(parentContactSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" data-testid="parent-form" {...formProps}>
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("දෙමාපියන්ගේ Email ලිපිනය")} name="parentEmail" type="email" inputMode="email" required={false} defaultValue={v.parentEmail} error={fe?.parentEmail} />
      <Field label={t("දෙමාපියන්ගේ දුරකතන අංකය (WhatsApp)")} name="parentPhone" type="tel" inputMode="tel" required={false} placeholder="07XXXXXXXX" defaultValue={v.parentPhone} error={fe?.parentPhone} />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="parentOptIn" defaultChecked={v.parentOptIn === "on"} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
        <span>{t("දෙමාපියන්ට සතිපතා ප්‍රගති සාරාංශය (පාඩම්, Quiz ලකුණු, පැවරුම්) යැවීමට දෙමාපියන් එකඟයි.")}</span>
      </label>
      <p className="text-xs text-muted">{t("සාරාංශය යවන්නේ දෙමාපියන්ගේ එකඟත්වය ඇති විට පමණි. ඕනෑම වේලාවක මෙය ඉවත් කළ හැක; Email හි unsubscribe link එකද ඇත.")}</p>
      <SubmitButton pendingText="සුරකිමින්...">{t("සුරකින්න")}</SubmitButton>
    </form>
  );
}

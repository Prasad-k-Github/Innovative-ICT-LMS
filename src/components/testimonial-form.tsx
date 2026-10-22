"use client";

import type { FormState } from "@/lib/validators";
import { testimonialSchema } from "@/lib/validators";
import { useKeyedForm } from "./content-forms";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, TextAreaField } from "./ui";
import { useFormValidation } from "./use-form-validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// Testimonial එකක් එක් කිරීම / වෙනස් කිරීම (initial ඇත්නම් වෙනස් කිරීමකි)
export function TestimonialForm({
  action,
  submitLabel,
  initial,
}: {
  action: Action;
  submitLabel: string;
  initial?: {
    id: string;
    authorName: string;
    authorInfo: string;
    quote: string;
    published: boolean;
    pending?: boolean;
  };
}) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, {} as FormState);
  const v: Record<string, string> = state.values ?? {};
  const { fe, formProps } = useFormValidation(
    testimonialSchema,
    state.fieldErrors,
  );
  const pick = (k: "authorName" | "authorInfo" | "quote") =>
    v[k] ?? initial?.[k] ?? "";
  const published = state.values
    ? state.values.published === "on"
    : (initial?.published ?? true);
  const sfx = initial?.id ?? "new";
  return (
    <form
      key={state.n ?? 0}
      action={formAction}
      className="space-y-4"
      {...formProps}
      data-testid={initial ? "testimonial-edit-form" : "testimonial-form"}
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field
        id={`t-name-${sfx}`}
        label={t("නම")}
        name="authorName"
        defaultValue={pick("authorName")}
        error={fe?.authorName}
        placeholder={t("උදා: කමල් පෙරේරා")}
      />
      <Field
        id={`t-info-${sfx}`}
        label={t("විස්තරය (ශ්‍රේණිය, පන්තිය ආදිය — අවශ්‍ය නම්)")}
        name="authorInfo"
        defaultValue={pick("authorInfo")}
        error={fe?.authorInfo}
        required={false}
        placeholder={t("උදා: 11 ශ්‍රේණිය · Neth - Mapalagama")}
      />
      <TextAreaField
        id={`t-quote-${sfx}`}
        label={t("අදහස")}
        name="quote"
        defaultValue={pick("quote")}
        error={fe?.quote}
        rows={4}
        required
        placeholder={t("සිසුවා / දෙමාපියා පැවසූ දේ")}
        hint={t("අක්ෂර 10 – 600. සැබෑ අදහස් පමණක් එක් කරන්න.")}
      />
      {!initial?.pending && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            name="published"
            defaultChecked={published}
            className="h-5 w-5 rounded border-line accent-primary"
          />
          {t("Landing page එකේ පෙන්වන්න")}
        </label>
      )}
      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

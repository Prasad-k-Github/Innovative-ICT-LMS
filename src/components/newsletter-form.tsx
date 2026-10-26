"use client";

import { GRADES, MEDIUMS, MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { newsletterSchema, type FormState } from "@/lib/validators";
import { useKeyedForm } from "./content-forms";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, SelectField, TextAreaField, btnSecondary } from "./ui";
import { useFormValidation } from "./use-form-validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// Admin: Newsletter ලිවීම / සංස්කරණය. "සුරකින්න" = කෙටුම්පත (සිසුන්ට නොපෙනේ), "පළ කරන්න" = සිසුන්ට පෙනේ + දැනුම්දීම
export function NewsletterForm({
  action,
  institutes,
  id,
  initial,
  published,
}: {
  action: Action;
  institutes: { id: string; name: string }[];
  id?: string;
  initial?: Record<string, string>;
  published?: boolean;
}) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: initial } as FormState);
  const v: Record<string, string> = state.values ?? initial ?? {};
  const { fe, formProps } = useFormValidation(newsletterSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps} data-testid="newsletter-form">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field id="n-title" label={t("මාතෘකාව")} name="title" defaultValue={v.title} error={fe?.title} placeholder={t("උදා: ඔක්තෝබර් මාසයේ පන්ති පුවත්")} />
      <TextAreaField id="n-summary" label={t("කෙටි සාරාංශය (Dashboard card එකේ පෙනේ)")} name="summary" rows={2} defaultValue={v.summary} error={fe?.summary} />
      <TextAreaField
        id="n-body"
        label={t("අන්තර්ගතය")}
        name="body"
        rows={10}
        required
        defaultValue={v.body}
        error={fe?.body}
        hint={t("සරල පෙළ. අලුත් පේළි සහ ඡේද එලෙසම පෙනේ.")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField id="n-grade" optional label={t("ශ්‍රේණිය")} name="grade" placeholder={t("සියලු ශ්‍රේණි")} defaultValue={v.grade} error={fe?.grade} options={GRADES.map((g) => ({ value: String(g), label: gradeLabel(g, null, t) }))} />
        <SelectField id="n-medium" optional label={t("මාධ්‍යය")} name="medium" placeholder={t("සියලු මාධ්‍ය")} defaultValue={v.medium} error={fe?.medium} options={MEDIUMS.map((m) => ({ value: m, label: t(MEDIUM_LABELS[m]) }))} />
      </div>
      <SelectField id="n-institute" optional label={t("ආයතනය")} name="instituteId" placeholder={t("සියලු ආයතන")} defaultValue={v.instituteId} error={fe?.instituteId} options={institutes.map((i) => ({ value: i.id, label: i.name }))} />
      <p className="text-xs text-muted">{t("10 සහ 11 ශ්‍රේණි (O/L) එකම අන්තර්ගතය බෙදා ගන්නා නිසා එකක් තෝරා ගත්විට දෙකටම පෙනේ.")}</p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="සුරකිමින්...">{published ? t("යාවත්කාලීන කරන්න") : t("පළ කරන්න")}</SubmitButton>
        {!published && (
          <button type="submit" name="intent" value="draft" className={btnSecondary} data-testid="newsletter-draft">
            {t("කෙටුම්පතක් ලෙස සුරකින්න")}
          </button>
        )}
      </div>
    </form>
  );
}

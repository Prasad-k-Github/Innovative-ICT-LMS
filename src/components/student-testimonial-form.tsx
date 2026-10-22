"use client";

import { studentTestimonialSchema, type FormState } from "@/lib/validators";
import { useKeyedForm } from "./content-forms";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, FieldError, TextAreaField } from "./ui";
import { useFormValidation } from "./use-form-validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// සිසුවා තමන්ගේ අදහස එවයි. නම පෙන්වන ආකාරය තෝරා, ප්‍රසිද්ධියේ පෙන්වීමට එකඟ විය යුතුය
export function StudentTestimonialForm({ action, firstName, initials, gradeText }: { action: Action; firstName: string; initials: string; gradeText: string }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, {} as FormState);
  const v: Record<string, string> = state.values ?? {};
  const { fe, formProps } = useFormValidation(studentTestimonialSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-5" {...formProps} data-testid="feedback-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <TextAreaField
        id="fb-quote"
        label={t("ඔබේ අදහස")}
        name="quote"
        defaultValue={v.quote}
        error={fe?.quote}
        rows={5}
        required
        placeholder={t("පන්තිය / මෙම පද්ධතිය ගැන ඔබට හිතෙන දේ ලියන්න")}
        hint={t("අක්ෂර 10 – 600. ඔබේ සැබෑ අදහස පමණක් ලියන්න.")}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">{t("ඔබේ නම පෙන්විය යුත්තේ කෙසේද?")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([["first", firstName], ["initials", initials]] as const).map(([val, label]) => (
            <label key={val} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input type="radio" name="nameStyle" value={val} defaultChecked={(v.nameStyle ?? "first") === val} className="h-4 w-4 accent-primary" />
              <span>
                {val === "first" ? t("මුල් නම පමණි") : t("මුල් අකුරු පමණි")}: <strong>{label}</strong>
              </span>
            </label>
          ))}
        </div>
        <FieldError error={fe?.nameStyle} />
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
        <input type="checkbox" name="showGrade" defaultChecked={v.showGrade === "on"} className="h-5 w-5 rounded border-line accent-primary" />
        {t("ශ්‍රේණිය ද පෙන්වන්න")} ({gradeText})
      </label>

      <div className="rounded-xl bg-sun-soft p-4 text-sm leading-relaxed text-amber-950">
        <p>{t("ඔබේ අදහස Landing page එකේ ඕනෑම කෙනෙකුට පෙනේ. ගුරුතුමා අනුමත කළ පසුව පමණක් පෙන්වයි. ඔබේ සම්පූර්ණ නම, email හෝ දුරකථන අංකය කිසිවිටෙක පෙන්වන්නේ නැහැ.")}</p>
        <label className="mt-3 flex items-start gap-3 font-semibold">
          <input type="checkbox" name="consent" defaultChecked={v.consent === "on"} className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-primary" />
          <span>{t("මෙය ප්‍රසිද්ධියේ පෙන්වීමට මම එකඟයි. (වයස 18ට අඩු නම් දෙමාපියන්ගේ අවසරය ලබාගන්න.)")}</span>
        </label>
        <FieldError error={fe?.consent} />
      </div>

      <SubmitButton pendingText="යවමින්...">{t("අදහස යවන්න")}</SubmitButton>
    </form>
  );
}

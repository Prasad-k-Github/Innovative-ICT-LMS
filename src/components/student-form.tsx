"use client";

import { useActionState, useState } from "react";
import { AL_GRADE, GRADES, MEDIUMS, MEDIUM_LABELS, alExamYears, gradeLabel } from "@/lib/constants";
import { adminStudentSchema, type FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { useFormValidation } from "./use-form-validation";
import { SubmitButton } from "./submit-button";
import { Alert, Field, SelectField } from "./ui";

// Admin: සිසුවෙකු සෑදීම සහ සංස්කරණය සඳහා පොදු form එක (මුරපද ක්ෂේත්‍ර නැත)
export function StudentForm({
  action,
  institutes,
  initial,
  id,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  institutes: { id: string; name: string }[];
  initial?: Record<string, string>;
  id?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({
      ...(await action(prev, fd)),
      n: (prev.n ?? 0) + 1,
    }),
    { values: initial } as FormState,
  );
  const v = state.values ?? initial;
  const { fe, formProps } = useFormValidation(adminStudentSchema, state.fieldErrors);
  const [grade, setGrade] = useState(v?.grade ?? "");
  const t = useT();

  return (
    // key: සෑම ප්‍රතිචාරයකදීම නැවත සාදයි (select අගයන් රඳවා ගැනීමට)
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps}>
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}

      <Field label={t("සම්පූර්ණ නම")} name="name" defaultValue={v?.name} error={fe?.name} />
      <Field label={t("පාසල")} name="school" defaultValue={v?.school} error={fe?.school} />
      <SelectField
        label={t("ශ්‍රේණිය")}
        name="grade"
        placeholder={t("ශ්‍රේණිය තෝරන්න")}
        defaultValue={v?.grade}
        error={fe?.grade}
        onChange={setGrade}
        options={GRADES.map((g) => ({ value: String(g), label: gradeLabel(g, null, t) }))}
      />
      {grade === String(AL_GRADE) && (
        <SelectField
          label={t("උසස් පෙළ විභාගය පැවැත්වෙන වර්ෂය")}
          name="alYear"
          placeholder={t("වර්ෂය තෝරන්න")}
          defaultValue={v?.alYear}
          error={fe?.alYear}
          options={yearOptions(v?.alYear)}
        />
      )}
      <SelectField
        label={t("මාධ්‍යය")}
        name="medium"
        placeholder={t("මාධ්‍යය තෝරන්න")}
        defaultValue={v?.medium}
        error={fe?.medium}
        options={MEDIUMS.map((m) => ({ value: m, label: t(MEDIUM_LABELS[m]) }))}
      />
      <Field label={t("දුරකතන අංකය")} name="phone" type="tel" inputMode="tel" placeholder="07XXXXXXXX" defaultValue={v?.phone} error={fe?.phone} />
      <Field label={t("Email ලිපිනය")} name="email" type="email" inputMode="email" defaultValue={v?.email} error={fe?.email} />
      <SelectField
        label={t("පැමිණෙන ආයතනය")}
        name="instituteId"
        placeholder={t("ආයතනය තෝරන්න")}
        defaultValue={v?.instituteId}
        error={fe?.instituteId}
        options={institutes.map((i) => ({ value: i.id, label: i.name }))}
      />

      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

// දැනටමත් ඇති (පැරණි) වර්ෂයක් තිබේ නම් එයද විකල්පයක් ලෙස තබයි
function yearOptions(current?: string) {
  const years = alExamYears().map(String);
  if (current && !years.includes(current)) years.unshift(current);
  return years.map((y) => ({ value: y, label: y }));
}

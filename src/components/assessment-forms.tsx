"use client";

import { useActionState } from "react";
import { GRADES, MEDIUMS, MEDIUM_LABELS, QUIZ_MAX_OPTIONS, gradeLabel } from "@/lib/constants";
import { assignmentSchema, questionSchema, gradeSubmissionSchema, quizSchema, type FormState } from "@/lib/validators";
import { useKeyedForm } from "./content-forms";
import { useT } from "./i18n-provider";
import { useFormValidation } from "./use-form-validation";
import { SubmitButton } from "./submit-button";
import { Alert, Field, SelectField, TextAreaField, inputClass } from "./ui";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Institute = { id: string; name: string };

// ශ්‍රේණිය + මාධ්‍යය (+ අවශ්‍ය නම් ආයතනය) තේරීම: පැවරුම් සහ Quiz දෙකටම පොදුයි
function TargetFields({ v, fe, institutes }: { v: Record<string, string>; fe?: FormState["fieldErrors"]; institutes: Institute[] }) {
  const t = useT();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="f-grade"
          label={t("ශ්‍රේණිය")}
          name="grade"
          placeholder={t("ශ්‍රේණිය තෝරන්න")}
          defaultValue={v.grade}
          error={fe?.grade}
          options={GRADES.map((g) => ({ value: String(g), label: gradeLabel(g, null, t) }))}
        />
        <SelectField
          id="f-medium"
          label={t("මාධ්‍යය")}
          name="medium"
          placeholder={t("මාධ්‍යය තෝරන්න")}
          defaultValue={v.medium}
          error={fe?.medium}
          options={MEDIUMS.map((m) => ({ value: m, label: t(MEDIUM_LABELS[m]) }))}
        />
      </div>
      <SelectField
        id="f-institute"
        optional
        label={t("ආයතනය")}
        name="instituteId"
        placeholder={t("සියලු ආයතන")}
        defaultValue={v.instituteId}
        error={fe?.instituteId}
        options={institutes.map((i) => ({ value: i.id, label: i.name }))}
      />
    </>
  );
}

export function AssignmentForm({
  action,
  institutes,
  id,
  initial,
  submitLabel,
}: {
  action: Action;
  institutes: Institute[];
  id?: string;
  initial?: Record<string, string>;
  submitLabel: string;
}) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: initial } as FormState);
  const v: Record<string, string> = state.values ?? initial ?? {};
  const { fe, formProps } = useFormValidation(assignmentSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps}>
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field id="f-title" label={t("මාතෘකාව")} name="title" defaultValue={v.title} error={fe?.title} />
      <TextAreaField id="f-description" label={t("උපදෙස් / විස්තරය")} name="description" defaultValue={v.description} error={fe?.description} rows={4} />
      <TargetFields v={v} fe={fe} institutes={institutes} />
      <Field
        id="f-due"
        label={t("අවසාන දිනය සහ වේලාව (ශ්‍රී ලංකා වේලාව)")}
        name="dueAt"
        type="datetime-local"
        defaultValue={v.dueAt}
        error={fe?.dueAt}
      />
      <Field
        id="f-max"
        label={t("උපරිම ලකුණු (අවශ්‍ය නම්)")}
        name="maxMarks"
        inputMode="numeric"
        required={false}
        defaultValue={v.maxMarks}
        error={fe?.maxMarks}
      />
      <Field
        id="f-attachment"
        label={t("ප්‍රශ්න පත්‍රය / Drive link (අවශ්‍ය නම්)")}
        name="attachmentUrl"
        type="url"
        inputMode="url"
        required={false}
        defaultValue={v.attachmentUrl}
        error={fe?.attachmentUrl}
        placeholder="https://drive.google.com/..."
      />
      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

export function QuizForm({
  action,
  institutes,
  id,
  initial,
  submitLabel,
}: {
  action: Action;
  institutes: Institute[];
  id?: string;
  initial?: Record<string, string>;
  submitLabel: string;
}) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: initial } as FormState);
  const v: Record<string, string> = state.values ?? initial ?? {};
  const { fe, formProps } = useFormValidation(quizSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps}>
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field id="f-title" label={t("Quiz මාතෘකාව")} name="title" defaultValue={v.title} error={fe?.title} />
      <TextAreaField id="f-description" label={t("උපදෙස් / විස්තරය")} name="description" defaultValue={v.description} error={fe?.description} rows={3} />
      <TargetFields v={v} fe={fe} institutes={institutes} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="f-opens" label={t("ආරම්භ වන වේලාව (ශ්‍රී ලංකා වේලාව)")} name="opensAt" type="datetime-local" defaultValue={v.opensAt} error={fe?.opensAt} />
        <Field id="f-closes" label={t("වසන වේලාව (ශ්‍රී ලංකා වේලාව)")} name="closesAt" type="datetime-local" defaultValue={v.closesAt} error={fe?.closesAt} />
      </div>
      <Field
        id="f-duration"
        label={t("සිසුවෙකුට ලැබෙන කාලය (විනාඩි)")}
        name="durationMinutes"
        inputMode="numeric"
        defaultValue={v.durationMinutes}
        error={fe?.durationMinutes}
        hint={t("සිසුවා Start ඔබන මොහොතේ සිට ගණන් කරයි; Quiz වසන වේලාවෙන් පසු දිගු නොවේ.")}
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="revealAnswers" defaultChecked={v.revealAnswers === "on"} className="mt-1 h-4 w-4" />
        <span>{t("Quiz වසා දැමූ පසු නිවැරදි පිළිතුරු සිසුන්ට පෙන්වන්න")}</span>
      </label>
      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

// පැවරුමකට ලකුණු දීම / ප්‍රතිචාර සටහන
export function GradeForm({ action, id, marks, feedback, maxMarks }: { action: Action; id: string; marks: string; feedback: string; maxMarks: number | null }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: { marks, feedback } } as FormState);
  const v = state.values ?? { marks, feedback };
  const { fe, formProps } = useFormValidation(gradeSubmissionSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" {...formProps}>
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field
          id={`m-${id}`}
          label={maxMarks ? t("ලකුණු (/{max})", { max: maxMarks }) : t("ලකුණු")}
          name="marks"
          inputMode="numeric"
          required={false}
          defaultValue={v.marks}
          error={fe?.marks}
        />
        <TextAreaField id={`fb-${id}`} label={t("සිසුවාට සටහනක්")} name="feedback" rows={2} defaultValue={v.feedback} error={fe?.feedback} />
      </div>
      <SubmitButton pendingText="සුරකිමින්..." className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
        {t("ලකුණු සුරකින්න")}
      </SubmitButton>
    </form>
  );
}

// Quiz ප්‍රශ්නයක් එක් කිරීම / සංස්කරණය (පිළිතුරු 6ක් දක්වා)
export function QuestionForm({
  action,
  quizId,
  id,
  initial,
  submitLabel,
  prefix,
}: {
  action: Action;
  quizId?: string;
  id?: string;
  initial?: { text: string; options: string[]; correct: number; marks: number; explanation: string };
  submitLabel: string;
  prefix: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({ ...(await action(prev, fd)), n: (prev.n ?? 0) + 1 }),
    {} as FormState,
  );
  const { fe, formProps } = useFormValidation(questionSchema, state.fieldErrors, {
    extraKeys: ["options"],
    // server එකේ readQuestion() හා සමානව: option0..option5 → options[], හිස් marks = 1
    collect: (fd) => ({
      text: fd.get("text"),
      options: Array.from({ length: QUIZ_MAX_OPTIONS }, (_, i) => String(fd.get(`option${i}`) ?? "")),
      correct: fd.get("correct") ?? "-1",
      marks: fd.get("marks") || 1,
      explanation: fd.get("explanation") ?? "",
    }),
  });
  // දෝෂයක් ඇති විට ඇතුළත් කළ අගයන් රඳවා ගනී; සාර්ථක නම් (අලුත් ප්‍රශ්නයකදී) හිස් කරයි
  const sv = state.values;
  const keep = sv && !state.ok;
  const opt = (i: number) => (keep ? sv[`option${i}`] : initial?.options[i]) ?? "";
  const correct = keep ? sv.correct : initial ? String(initial.correct) : "";
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" {...formProps}>
      {quizId && <input type="hidden" name="quizId" value={quizId} />}
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <TextAreaField id={`${prefix}-text`} label={t("ප්‍රශ්නය")} name="text" rows={2} required defaultValue={keep ? sv.text : initial?.text} error={fe?.text} />
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">{t("පිළිතුරු (නිවැරදි පිළිතුර තෝරන්න)")}</legend>
        {Array.from({ length: QUIZ_MAX_OPTIONS }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              value={i}
              id={`${prefix}-correct-${i}`}
              defaultChecked={correct === String(i)}
              aria-label={t("නිවැරදි පිළිතුර: {n}", { n: i + 1 })}
              className="h-5 w-5 shrink-0"
            />
            <input
              name={`option${i}`}
              id={`${prefix}-option-${i}`}
              defaultValue={opt(i)}
              placeholder={t("පිළිතුර {n}", { n: i + 1 })}
              className={inputClass}
              aria-label={t("පිළිතුර {n}", { n: i + 1 })}
            />
          </div>
        ))}
        {fe?.options?.[0] && <p className="text-sm text-red-600">{fe.options[0]}</p>}
        {fe?.correct?.[0] && <p className="text-sm text-red-600">{fe.correct[0]}</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field id={`${prefix}-marks`} label={t("ලකුණු")} name="marks" inputMode="numeric" defaultValue={keep ? sv.marks : String(initial?.marks ?? 1)} error={fe?.marks} />
        <TextAreaField
          id={`${prefix}-explanation`}
          label={t("පැහැදිලි කිරීම (අවශ්‍ය නම්)")}
          name="explanation"
          rows={2}
          defaultValue={keep ? sv.explanation : initial?.explanation}
          error={fe?.explanation}
        />
      </div>
      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

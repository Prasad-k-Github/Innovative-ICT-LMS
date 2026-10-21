"use client";

import { useActionState } from "react";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/constants";
import type { FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, SelectField } from "./ui";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function useKeyedForm(action: Action, initial: FormState) {
  return useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({
      ...(await action(prev, fd)),
      n: (prev.n ?? 0) + 1,
    }),
    initial,
  );
}

// අලුත් පාඩමක් එක් කිරීම (ශ්‍රේණිය සහ මාධ්‍යය සඳහා)
export function LessonCreateForm({ action, grade, medium }: { action: Action; grade: number; medium: string }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, {});
  const fe = state.fieldErrors;
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="grade" value={grade} />
      <input type="hidden" name="medium" value={medium} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field id="new-lesson-title" label={t("අලුත් පාඩමේ නම")} name="title" defaultValue={state.values?.title} error={fe?.title} />
      <Field
        id="new-lesson-order"
        label={t("පාඩම් අංකය (හිස් නම් අවසානයට)")}
        name="order"
        type="number"
        inputMode="numeric"
        required={false}
        defaultValue={state.values?.order}
        error={fe?.order}
      />
      <SubmitButton pendingText="සුරකිමින්...">{t("පාඩම එක් කරන්න")}</SubmitButton>
    </form>
  );
}

export function LessonEditForm({ action, id, title, order }: { action: Action; id: string; title: string; order: number }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: { title, order: String(order) } } as FormState);
  const v = state.values ?? { title, order: String(order) };
  const fe = state.fieldErrors;
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("පාඩමේ නම")} name="title" defaultValue={v.title} error={fe?.title} />
      <Field label={t("පාඩම් අංකය")} name="order" type="number" inputMode="numeric" defaultValue={v.order} error={fe?.order} />
      <SubmitButton pendingText="සුරකිමින්...">{t("සුරකින්න")}</SubmitButton>
    </form>
  );
}

// Google Drive link එකක් එක් කිරීම / සංස්කරණය
export function ResourceForm({
  action,
  types,
  lessonId,
  grade,
  medium,
  id,
  initial,
  submitLabel,
  prefix,
}: {
  action: Action;
  types: ContentType[];
  lessonId?: string;
  grade?: number;
  medium?: string;
  id?: string;
  initial?: Record<string, string>;
  submitLabel: string;
  prefix: string;
}) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, { values: initial } as FormState);
  const v: Record<string, string> = state.values ?? initial ?? {};
  const fe = state.fieldErrors;
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {lessonId && <input type="hidden" name="lessonId" value={lessonId} />}
      {grade !== undefined && <input type="hidden" name="grade" value={grade} />}
      {medium && <input type="hidden" name="medium" value={medium} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <SelectField
        id={`${prefix}-type`}
        label={t("වර්ගය")}
        name="type"
        placeholder={t("වර්ගය තෝරන්න")}
        defaultValue={v.type}
        error={fe?.type}
        options={types.map((ty) => ({ value: ty, label: t(CONTENT_TYPE_LABELS[ty]) }))}
      />
      <Field id={`${prefix}-title`} label={t("නම (අවශ්‍ය නම්)")} name="title" required={false} defaultValue={v.title} error={fe?.title} placeholder={t("උදා: Tute 1")} />
      <Field
        id={`${prefix}-url`}
        label={t("Google Drive link")}
        name="driveUrl"
        type="url"
        inputMode="url"
        defaultValue={v.driveUrl}
        error={fe?.driveUrl}
        placeholder="https://drive.google.com/..."
      />
      <Field
        id={`${prefix}-year`}
        label={t("වර්ෂය (Past Paper සඳහා)")}
        name="year"
        inputMode="numeric"
        required={false}
        defaultValue={v.year}
        error={fe?.year}
        placeholder="2023"
      />
      <SubmitButton pendingText="සුරකිමින්...">{submitLabel}</SubmitButton>
    </form>
  );
}

"use client";

import { replySchema, threadSchema, type FormState } from "@/lib/validators";
import { useKeyedForm } from "./content-forms";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, TextAreaField } from "./ui";
import { useFormValidation } from "./use-form-validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// අලුත් මාතෘකාවක් (Forum thread)
export function ThreadForm({ action, room }: { action: Action; room: string }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, {} as FormState);
  const v: Record<string, string> = state.values ?? {};
  const { fe, formProps } = useFormValidation(threadSchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" {...formProps} data-testid="thread-form">
      <input type="hidden" name="room" value={room} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field id="th-title" label={t("මාතෘකාව")} name="title" defaultValue={v.title} error={fe?.title} placeholder={t("ඔබේ ප්‍රශ්නය කෙටියෙන් ලියන්න")} />
      <TextAreaField id="th-body" label={t("විස්තරය")} name="body" defaultValue={v.body} error={fe?.body} rows={4} required hint={t("link, email සහ දුරකථන අංක එක් කළ නොහැක.")} />
      <SubmitButton pendingText="යවමින්...">{t("මාතෘකාව පළ කරන්න")}</SubmitButton>
    </form>
  );
}

// මාතෘකාවකට පිළිතුරක්
export function ReplyForm({ action, threadId }: { action: Action; threadId: string }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(action, {} as FormState);
  const v: Record<string, string> = state.values ?? {};
  const { fe, formProps } = useFormValidation(replySchema, state.fieldErrors);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-3" {...formProps} data-testid="reply-form">
      <input type="hidden" name="threadId" value={threadId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <TextAreaField id="reply-body" label={t("ඔබේ පිළිතුර")} name="body" defaultValue={v.body} error={fe?.body} rows={3} required hint={t("ගරුසරු ලෙස, ICT ගැන පමණක් ලියන්න. link, email සහ දුරකථන අංක එක් කළ නොහැක.")} />
      <SubmitButton pendingText="යවමින්...">{t("පිළිතුර යවන්න")}</SubmitButton>
    </form>
  );
}

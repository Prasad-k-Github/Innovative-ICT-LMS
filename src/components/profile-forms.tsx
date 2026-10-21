"use client";

import { useActionState, useState } from "react";
import { AL_GRADE, GRADES, MEDIUMS, MEDIUM_LABELS, alExamYears, gradeLabel } from "@/lib/constants";
import type { FormState } from "@/lib/validators";
import { changePasswordAction, deleteAccountAction, requestChangeAction, updateProfileAction } from "@/app/actions/student";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, Field, SelectField, btnPrimary } from "./ui";

// සෑම ප්‍රතිචාරයකදීම form එක නැවත සාදන (key) action wrapper: select අගයන් රඳවා ගැනීමට
function useForm(action: (p: FormState, fd: FormData) => Promise<FormState>, initial: FormState = {}) {
  return useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({
      ...(await action(prev, fd)),
      n: (prev.n ?? 0) + 1,
    }),
    initial,
  );
}

export function ProfileForm({ initial }: { initial: { name: string; school: string; phone: string } }) {
  const t = useT();
  const [state, formAction] = useForm(updateProfileAction, { values: initial });
  const v = state.values ?? initial;
  const fe = state.fieldErrors;
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("සම්පූර්ණ නම")} name="name" defaultValue={v.name} error={fe?.name} autoComplete="name" />
      <Field label={t("පාසල")} name="school" defaultValue={v.school} error={fe?.school} />
      <Field label={t("දුරකතන අංකය")} name="phone" type="tel" inputMode="tel" defaultValue={v.phone} error={fe?.phone} autoComplete="tel" />
      <SubmitButton pendingText="සුරකිමින්...">{t("සුරකින්න")}</SubmitButton>
    </form>
  );
}

export function ChangeRequestForm({
  institutes,
  current,
}: {
  institutes: { id: string; name: string }[];
  current: { grade: string; alYear: string; medium: string; instituteId: string };
}) {
  const t = useT();
  const [state, formAction] = useForm(requestChangeAction, { values: current } as FormState);
  const v: Record<string, string> = state.values ?? current;
  const fe = state.fieldErrors;
  const [grade, setGrade] = useState(v.grade ?? "");
  const years = alExamYears().map(String);
  if (v.alYear && !years.includes(v.alYear)) years.unshift(v.alYear);
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <SelectField
        label={t("ශ්‍රේණිය")}
        name="grade"
        placeholder={t("ශ්‍රේණිය තෝරන්න")}
        defaultValue={v.grade}
        error={fe?.grade}
        onChange={setGrade}
        options={GRADES.map((g) => ({ value: String(g), label: gradeLabel(g, null, t) }))}
      />
      {grade === String(AL_GRADE) && (
        <SelectField
          label={t("උසස් පෙළ විභාගය පැවැත්වෙන වර්ෂය")}
          name="alYear"
          placeholder={t("වර්ෂය තෝරන්න")}
          defaultValue={v.alYear}
          error={fe?.alYear}
          options={years.map((y) => ({ value: y, label: y }))}
        />
      )}
      <SelectField
        label={t("මාධ්‍යය")}
        name="medium"
        placeholder={t("මාධ්‍යය තෝරන්න")}
        defaultValue={v.medium}
        error={fe?.medium}
        options={MEDIUMS.map((m) => ({ value: m, label: t(MEDIUM_LABELS[m]) }))}
      />
      <SelectField
        label={t("පැමිණෙන ආයතනය")}
        name="instituteId"
        placeholder={t("ආයතනය තෝරන්න")}
        defaultValue={v.instituteId}
        error={fe?.instituteId}
        options={institutes.map((i) => ({ value: i.id, label: i.name }))}
      />
      <Field label={t("සටහන (අවශ්‍ය නම්)")} name="note" required={false} defaultValue={v.note} error={fe?.note} />
      <SubmitButton pendingText="යවමින්...">{t("ඉල්ලීම යවන්න")}</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const t = useT();
  const [state, formAction] = useForm(changePasswordAction);
  const fe = state.fieldErrors;
  return (
    <form key={state.n ?? 0} action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      <Field label={t("වත්මන් මුරපදය")} name="currentPassword" type="password" autoComplete="current-password" error={fe?.currentPassword} />
      <Field
        label={t("නව මුරපදය")}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t("අවම වශයෙන් අක්ෂර 8ක්, අකුරු සහ ඉලක්කම් සහිතව")}
        error={fe?.password}
      />
      <Field label={t("නව මුරපදය නැවත ඇතුළත් කරන්න")} name="confirmPassword" type="password" autoComplete="new-password" error={fe?.confirmPassword} />
      <SubmitButton pendingText="සුරකිමින්...">{t("මුරපදය වෙනස් කරන්න")}</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const t = useT();
  const [state, formAction] = useForm(deleteAccountAction);
  const fe = state.fieldErrors;
  return (
    <form
      key={state.n ?? 0}
      action={formAction}
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        if (!window.confirm(t("ඔබගේ ගිණුම සදහටම මකා දමන්නද? මෙය ආපසු හැරවිය නොහැක."))) e.preventDefault();
      }}
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label={t("තහවුරු කිරීමට ඔබගේ මුරපදය ඇතුළත් කරන්න")} name="password" type="password" autoComplete="current-password" error={fe?.password} />
      <SubmitButton
        pendingText="මකමින්..."
        className={`${btnPrimary} !bg-red-600 hover:!bg-red-700`}
      >
        {t("මගේ ගිණුම මකන්න")}
      </SubmitButton>
    </form>
  );
}

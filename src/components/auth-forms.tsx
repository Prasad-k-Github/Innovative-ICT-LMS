"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  setPasswordAction,
} from "@/app/actions/auth";
import { AL_GRADE, GRADES, MEDIUMS, MEDIUM_LABELS, alExamYears, gradeLabel } from "@/lib/constants";
import { emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema, type FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { Icon } from "./icons";
import { SubmitButton } from "./submit-button";
import { Turnstile } from "./turnstile";
import { useFormValidation } from "./use-form-validation";
import { Alert, Field, FieldError, SelectField, btnPrimary } from "./ui";

const initial: FormState = {};

/* -------------------------------- Login -------------------------------- */

export function LoginForm({ next }: { next?: string | null }) {
  const t = useT();
  // loginAction කෙලින්ම භාවිතා කරයි (wrapper නැත) - එවිට JavaScript නොමැතිවත් login වීම ක්‍රියා කරයි (progressive enhancement)
  const [state, formAction] = useActionState(loginAction, initial);
  const { fe, formProps } = useFormValidation(loginSchema, state.fieldErrors);
  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <Alert kind="error">
          {state.error}
          {state.code === "UNVERIFIED" && (
            <>
              {" "}
              <Link href="/resend-verification" className="font-semibold underline">
                {t("Email එක නැවත යවන්න")}
              </Link>
            </>
          )}
        </Alert>
      )}
      <Field label={t("Email හෝ Index අංකය")} name="email" type="text" autoComplete="username" placeholder="PU-S-2026-0007" hint={t("ලියාපදිංචි වීමෙන් පසු ලැබුණු Index අංකයෙන් හෝ Email ලිපිනයෙන් login විය හැක.")} defaultValue={state.values?.email} error={fe?.email} />
      <Field label={t("මුරපදය")} name="password" type="password" autoComplete="current-password" error={fe?.password} />
      <div className="text-right">
        <Link href="/forgot-password" className="inline-flex min-h-8 items-center text-sm font-medium text-primary hover:underline">
          {t("මුරපදය අමතකද?")}
        </Link>
      </div>
      {state.captcha && <Turnstile />}
      <SubmitButton>{t("Login වන්න")}</SubmitButton>
    </form>
  );
}

/* ------------------------------- Register ------------------------------ */

export function RegisterForm({ institutes }: { institutes: { id: string; name: string }[] }) {
  const t = useT();
  const [state, formAction] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({
      ...(await registerAction(prev, fd)),
      n: (prev.n ?? 0) + 1,
    }),
    initial,
  );
  const { fe, formProps } = useFormValidation(registerSchema, state.fieldErrors);
  const v = state.values;
  const [grade, setGrade] = useState(v?.grade ?? "");
  return (
    // key: සෑම ප්‍රතිචාරයකදීම form එක නැවත සාදයි, එවිට React හි auto-reset නිසා
    // select ක්ෂේත්‍රවල තෝරාගත් අගයන් මැකී නොයයි
    <form key={state.n ?? 0} action={formAction} className="grid gap-x-5 gap-y-4 md:grid-cols-2" {...formProps}>
      {state.error && (
        <div className="md:col-span-2">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}

      <Field label={t("සම්පූර්ණ නම")} name="name" autoComplete="name" defaultValue={v?.name} error={fe?.name} />
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
      <SelectField
        label={t("මාධ්‍යය")}
        name="medium"
        placeholder={t("මාධ්‍යය තෝරන්න")}
        defaultValue={v?.medium}
        error={fe?.medium}
        options={MEDIUMS.map((m) => ({ value: m, label: t(MEDIUM_LABELS[m]) }))}
      />
      {grade === String(AL_GRADE) && (
        <div className="md:col-span-2">
          <SelectField
            label={t("උසස් පෙළ විභාගය පැවැත්වෙන වර්ෂය")}
            name="alYear"
            placeholder={t("වර්ෂය තෝරන්න")}
            defaultValue={v?.alYear}
            error={fe?.alYear}
            options={alExamYears().map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
      )}
      <Field
        label={t("දුරකතන අංකය")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="07XXXXXXXX"
        defaultValue={v?.phone}
        error={fe?.phone}
      />
      <Field label={t("Email ලිපිනය")} name="email" type="email" inputMode="email" autoComplete="email" defaultValue={v?.email} error={fe?.email} />
      <div className="md:col-span-2">
        <SelectField
          label={t("පැමිණෙන ආයතනය")}
          name="instituteId"
          placeholder={t("ආයතනය තෝරන්න")}
          defaultValue={v?.instituteId}
          error={fe?.instituteId}
          options={institutes.map((i) => ({ value: i.id, label: i.name }))}
        />
      </div>

      <p className="flex items-start gap-2.5 rounded-xl bg-sun-soft px-4 py-3 text-sm leading-relaxed text-amber-950 md:col-span-2">
        <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        {t("මුරපදය සාදන්නේ ඔබගේ email ලිපිනය තහවුරු කළ පසුවය.")}
      </p>

      <div className="md:col-span-2">
        <label htmlFor="consent" className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5 text-sm leading-relaxed text-ink">
          <input id="consent" type="checkbox" name="consent" defaultChecked={v?.consent === "on"} aria-invalid={fe?.consent ? true : undefined} className="mt-0.5 h-6 w-6 shrink-0 rounded border-line accent-primary" />
          <span>
            {t("මම")}{" "}
            <Link href="/privacy" target="_blank" className="inline-block py-1 font-semibold text-primary underline underline-offset-2">
              {t("පෞද්ගලිකත්ව ප්‍රතිපත්තිය")}
            </Link>{" "}
            {t("කියවා එයට එකඟ වෙමි. මා වයස 18ට අඩු නම්, මගේ දෙමාපියන්ගේ/භාරකරුගේ අවසරය ලබාගෙන ඇත.")}
          </span>
        </label>
        <FieldError error={fe?.consent} />
      </div>

      <div className="md:col-span-2">
        <Turnstile />
      </div>

      <div className="md:col-span-2">
        <SubmitButton pendingText="ලියාපදිංචි වෙමින්...">{t("ලියාපදිංචි වන්න")}</SubmitButton>
      </div>
    </form>
  );
}

/* ------------- Email only forms (forgot password / resend verify) ------ */

function EmailForm({
  action,
  submitLabel,
  codeLink = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  codeLink?: boolean; // true: ඉලක්කම් 6ක code එක ඇතුළත් කරන තිරයට යොමු කරයි
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, initial);
  const { fe: emailFe, formProps } = useFormValidation(emailOnlySchema, state.fieldErrors);
  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{state.message}</Alert>
        {codeLink && state.values?.email && (
          <Link href={`/register/check-email?email=${encodeURIComponent(state.values.email)}`} className={btnPrimary}>
            {t("Code එක ඇතුළත් කරන්න")}
          </Link>
        )}
        <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
          {t("Login පිටුවට යන්න")}
        </Link>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label={t("Email ලිපිනය")} name="email" type="email" inputMode="email" autoComplete="email" error={emailFe.email} />
      <SubmitButton>{t(submitLabel)}</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  return <EmailForm action={forgotPasswordAction} submitLabel="Reset link එක යවන්න" />;
}

export function ResendVerificationForm() {
  return <EmailForm action={resendVerificationAction} submitLabel="තහවුරු කිරීමේ link එක යවන්න" codeLink />;
}

/* --------------------------- Reset password ---------------------------- */

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, formAction] = useActionState(resetPasswordAction, initial);
  const { fe, formProps } = useFormValidation(resetPasswordSchema, state.fieldErrors);
  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label={t("නව මුරපදය")}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t("අවම වශයෙන් අක්ෂර 8ක්, අකුරු සහ ඉලක්කම් සහිතව")}
        error={fe?.password}
      />
      <Field label={t("නව මුරපදය නැවත ඇතුළත් කරන්න")} name="confirmPassword" type="password" autoComplete="new-password" error={fe?.confirmPassword} />
      <SubmitButton>{t("මුරපදය වෙනස් කරන්න")}</SubmitButton>
    </form>
  );
}

/* ------------------- Set password (email තහවුරු කළ පසු) ---------------- */

export function SetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, formAction] = useActionState(setPasswordAction, initial);
  const { fe, formProps } = useFormValidation(resetPasswordSchema, state.fieldErrors);
  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label={t("මුරපදය")}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t("අවම වශයෙන් අක්ෂර 8ක්, අකුරු සහ ඉලක්කම් සහිතව")}
        error={fe?.password}
      />
      <Field label={t("මුරපදය නැවත ඇතුළත් කරන්න")} name="confirmPassword" type="password" autoComplete="new-password" error={fe?.confirmPassword} />
      <SubmitButton pendingText="සුරකිමින්...">{t("මුරපදය සාදන්න")}</SubmitButton>
    </form>
  );
}

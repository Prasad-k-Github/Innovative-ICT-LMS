"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { resendEmailCodeAction, verifyEmailCodeAction } from "@/app/actions/auth";
import { OTP_MINUTES, OTP_RESEND_SECONDS } from "@/lib/otp-config";
import { emailCodeSchema, type FormState } from "@/lib/validators";
import { useT } from "./i18n-provider";
import { Icon } from "./icons";
import { SubmitButton } from "./submit-button";
import { Alert, FieldError, inputErr } from "./ui";
import { useFormValidation } from "./use-form-validation";

const LEN = 6;

// තත්පරයක් ගාණේ යාවත්කාලීන වන clock (SSR වලදී 0 = තවම නොපෙන්වයි; hydration mismatch නැත)
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverNow = () => 0;

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function EmailCodeForm({ email, initialExpiresAt, mailFailed }: { email: string; initialExpiresAt: number | null; mailFailed: boolean }) {
  const t = useT();
  const now = useSyncExternalStore(subscribeClock, nowSeconds, serverNow);
  const formRef = useRef<HTMLFormElement>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const [state, formAction] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({ ...(await verifyEmailCodeAction(prev, fd)), n: (prev.n ?? 0) + 1 }),
    {} as FormState,
  );
  const [resend, resendAction, resending] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({ ...(await resendEmailCodeAction(prev, fd)), n: (prev.n ?? 0) + 1 }),
    {} as FormState,
  );
  const { fe, formProps } = useFormValidation(emailCodeSchema, state.fieldErrors);

  // දැනට පවතින code එකේ කල් ඉකුත් වීම: අලුත් code එකක් ඉල්ලූ පසු resend ප්‍රතිචාරයෙන් ලැබේ
  // (පිටුවට කෙලින්ම ආවොත් වේලාව නොදනී: countdown නැත, එහෙත් server එක තවමත් වලංගුභාවය පරීක්ෂා කරයි)
  const expiresAt = resend.expiresAt ?? initialExpiresAt;
  const sentAt = expiresAt === null ? null : expiresAt - OTP_MINUTES * 60_000;
  const left = now === 0 || expiresAt === null ? null : Math.max(0, Math.ceil(expiresAt / 1000) - now);
  const cooldown = now === 0 ? OTP_RESEND_SECONDS : sentAt === null ? 0 : Math.max(0, Math.ceil(sentAt / 1000) + OTP_RESEND_SECONDS - now);
  const expired = left === 0;

  // ඇතුළත් කළ ඉලක්කම්: server ප්‍රතිචාරයක් ආ පසු (වැරදි code එකක්) ස්වයංක්‍රීයව හිස් වේ
  const n = (state.n ?? 0) + (resend.n ?? 0);
  const [entry, setEntry] = useState({ n: 0, digits: "" });
  const digits = entry.n === n ? entry.digits : "";

  function setDigits(next: string) {
    const d = next.replace(/\D/g, "").slice(0, LEN);
    setEntry({ n, digits: d });
    return d;
  }
  function submitSoon() {
    setTimeout(() => formRef.current?.requestSubmit(), 60); // hidden input යාවත්කාලීන වීමෙන් පසු
  }
  function onBoxChange(i: number, value: string) {
    const v = value.replace(/\D/g, "");
    if (!v) {
      setDigits(digits.slice(0, i) + digits.slice(i + 1));
      return;
    }
    // එකවර ඉලක්කම් කිහිපයක් (paste / autofill): i වැනි පෙට්ටියේ සිට පුරවයි
    const merged = setDigits(digits.slice(0, i) + v + digits.slice(i + v.length));
    const target = Math.min(i + v.length, LEN - 1);
    boxes.current[target]?.focus();
    if (merged.length === LEN) submitSoon();
  }
  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      setDigits(digits.slice(0, i - 1) + digits.slice(i));
      boxes.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < LEN - 1) boxes.current[i + 1]?.focus();
  }
  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
    if (!text) return;
    e.preventDefault();
    const d = setDigits(text);
    boxes.current[Math.min(d.length, LEN - 1)]?.focus();
    if (d.length === LEN) submitSoon();
  }

  const codeErr = fe.code;
  return (
    <div className="space-y-5">
      {mailFailed && !resend.ok && (
        <Alert kind="warning">{t("ඔබගේ ගිණුම සාදන ලද නමුත් තහවුරු කිරීමේ email එක යැවීමට නොහැකි විය. පහත බොත්තමෙන් නැවත යවන්න.")}</Alert>
      )}
      {!mailFailed && !state.error && !resend.error && (
        <Alert kind="success">
          {t("ඉලක්කම් 6ක තහවුරු කිරීමේ code එකක් මෙම email ලිපිනයට යවා ඇත:")} <strong className="break-all">{email}</strong>
        </Alert>
      )}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {resend.error && <Alert kind="error">{resend.error}</Alert>}
      {resend.ok && !resend.error && <Alert kind="success">{resend.message}</Alert>}

      <form ref={formRef} action={formAction} className="space-y-4" {...formProps} data-testid="code-form">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={digits} />
        <div>
          <p id="code-label" className="mb-2 text-sm font-semibold text-ink">
            {t("තහවුරු කිරීමේ code එක")}
          </p>
          <div className="flex justify-between gap-2" role="group" aria-labelledby="code-label" onPaste={onPaste}>
            {Array.from({ length: LEN }, (_, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={digits[i] ?? ""}
                onChange={(e) => onBoxChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                pattern="[0-9]*"
                maxLength={i === 0 ? LEN : 1} // පළමු පෙට්ටියට paste / SMS autofill මුළු code එකම ඇතුළත් කළ හැක
                aria-label={t("ඉලක්කම {n}", { n: i + 1 })}
                aria-invalid={codeErr?.length ? true : undefined}
                data-code-box={i}
                disabled={expired}
                className={`h-14 w-full min-w-0 rounded-xl border border-line bg-white text-center font-display text-2xl font-bold text-navy shadow-[inset_0_1px_2px_rgb(11_22_51/0.05)] transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-slate-100 sm:h-16 ${codeErr?.length ? inputErr : ""}`}
              />
            ))}
          </div>
          <FieldError error={codeErr} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm" aria-live="off">
          <span className="flex items-center gap-2 text-navy">
            <Icon name="activity" className="h-4 w-4 text-primary" />
            {expired ? t("Code එක කල් ඉකුත් වී ඇත") : t("කල් ඉකුත් වීමට")}
          </span>
          <span data-testid="code-timer" className={`font-display text-lg font-bold tabular-nums ${expired ? "text-accent" : "text-primary"}`}>
            {left === null ? "--:--" : mmss(left)}
          </span>
        </div>

        <SubmitButton pendingText="තහවුරු කරමින්...">{t("තහවුරු කරන්න")}</SubmitButton>
      </form>

      <form action={resendAction} className="text-center">
        <input type="hidden" name="email" value={email} />
        <p className="text-sm text-muted">{t("Code එක ලැබුණේ නැද්ද?")}</p>
        <button
          type="submit"
          disabled={cooldown > 0 || resending}
          data-testid="resend-code"
          className="mt-1 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
        >
          {resending ? t("යවමින්...") : cooldown > 0 ? t("අලුත් code එකක් ඉල්ලන්න ({s}s)", { s: cooldown }) : t("අලුත් code එකක් ඉල්ලන්න")}
        </button>
      </form>

      <ul className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-muted">
        <li>{t("Code එක විනාඩි {n}ක් පමණක් වලංගුයි; වැරදි උත්සාහ 5කින් පසු අලුත් code එකක් ඉල්ලිය යුතුයි.", { n: OTP_MINUTES })}</li>
        <li>{t("Email එකේ ඇති link එක ඔබා ද තහවුරු කළ හැක.")}</li>
        <li>{t("Email එක නොපෙනේ නම් Spam / Junk folder එක පරීක්ෂා කරන්න.")}</li>
      </ul>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-medium">
        <Link href="/register" className="text-primary hover:underline">
          {t("වැරදි email එකක්ද? නැවත ලියාපදිංචි වන්න")}
        </Link>
        <Link href="/login" className="text-primary hover:underline">
          {t("Login පිටුවට යන්න")}
        </Link>
      </div>
    </div>
  );
}

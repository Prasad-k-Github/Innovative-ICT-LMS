import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PasswordInput } from "./password-input";

export const inputClass =
  "block w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink shadow-[inset_0_1px_2px_rgb(11_22_51/0.05)] placeholder:text-slate-400 transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-slate-100";

// වැරදි ඇති ක්ෂේත්‍රයක ශෛලිය
export const inputErr = "!border-red-400 bg-red-50/50 focus:!border-red-500 focus:!ring-red-500/15";

// ක්ෂේත්‍රය යට දෝෂ පණිවිඩය (icon සමඟ, role=alert)
export function FieldError({ error }: { error?: string[] }) {
  if (!error?.[0]) return null;
  return (
    <p role="alert" className="field-error mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-600">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      <span>{error[0]}</span>
    </p>
  );
}

export const btnPrimary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_20px_-10px_rgb(10_92_194/0.8)] transition hover:bg-primary-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-white px-5 py-3 text-base font-semibold text-ink transition hover:border-primary/40 hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

// අඳුරු (navy) පසුබිම් මත භාවිතා කරන බොත්තම්
export const btnSun =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sun px-6 py-3 text-base font-bold text-navy shadow-[0_12px_24px_-12px_rgb(255_196_46/0.9)] transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-sun/40";

export const btnGhostDark =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30";

// Header සඳහා කුඩා logo: gear icon + "innovative ICT". tone="dark": අඳුරු පසුබිම් සඳහා (සුදු අකුරු)
export function Logo({ href = "/", tone = "light" }: { href?: string; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Innovative ICT">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${dark ? "bg-white" : "bg-primary-soft"}`}>
        <Image src="/icon.png" alt="" width={30} height={30} className="h-[30px] w-[30px]" priority />
      </span>
      <span className={`font-display text-lg font-extrabold leading-none tracking-tight ${dark ? "text-white" : "text-navy"}`}>
        innovative <span className={dark ? "text-sun" : "text-accent"}>ICT</span>
      </span>
    </Link>
  );
}

// Login / Register පිටු සඳහා සම්පූර්ණ logo
export function LogoFull({ className = "h-28 w-auto" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Innovative ICT">
      <Image src="/logo.png" alt="Innovative ICT" width={700} height={560} className={className} priority />
    </Link>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const styles = {
    info: "border-primary/20 bg-primary-soft text-navy",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-accent-soft text-red-900",
    warning: "border-sun/60 bg-sun-soft text-amber-950",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  error,
  defaultValue,
  autoComplete,
  placeholder,
  inputMode,
  required = true,
  hint,
  id,
}: {
  id?: string;
  label: string;
  name: string;
  type?: string;
  error?: string[];
  defaultValue?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "url";
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id ?? name} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {(() => {
        const common = {
          id: id ?? name,
          name,
          defaultValue,
          autoComplete,
          placeholder,
          inputMode,
          required,
          "aria-invalid": error?.length ? true : undefined,
          className: `${inputClass} ${error?.length ? inputErr : ""}`,
        } as const;
        return type === "password" ? <PasswordInput {...common} /> : <input {...common} type={type} />;
      })()}
      {hint && !error?.length && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  defaultValue,
  placeholder,
  required = false,
  rows = 3,
  id,
  hint,
}: {
  id?: string;
  label: string;
  name: string;
  error?: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id ?? name} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id ?? name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={error?.length ? true : undefined}
        className={`${inputClass} ${error?.length ? inputErr : ""}`}
      />
      {hint && !error?.length && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  error,
  defaultValue,
  placeholder,
  options,
  onChange,
  id,
  optional = false,
}: {
  id?: string;
  optional?: boolean; // true: හිස් අගයක් (placeholder) තෝරා ගත හැක
  label: string;
  name: string;
  error?: string[];
  defaultValue?: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id ?? name} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id ?? name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={!optional}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={error?.length ? true : undefined}
        className={`${inputClass} ${error?.length ? inputErr : ""}`}
      >
        <option value="" disabled={!optional}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </div>
  );
}

export function StatusBadge({ status, t, suspension }: { status: "PENDING" | "ACTIVE" | "SUSPENDED"; t: (k: string) => string; suspension?: "temp" | "perm" }) {
  const map = {
    PENDING: ["අනුමැතිය බලාපොරොත්තුවෙන්", "bg-sun-soft text-amber-900", "bg-sun"],
    ACTIVE: ["සක්‍රියයි", "bg-emerald-50 text-emerald-800", "bg-emerald-500"],
    SUSPENDED: ["අත්හිටුවා ඇත", "bg-red-50 text-red-800", "bg-accent"],
  } as const;
  const [label0, cls, dot] = map[status];
  const label = status === "SUSPENDED" && suspension === "temp" ? "තාවකාලිකව අත්හිටුවා ඇත" : status === "SUSPENDED" && suspension === "perm" ? "ස්ථිරවම අත්හිටුවා ඇත" : label0;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {t(label)}
    </span>
  );
}

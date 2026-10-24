"use client";

import { useState, useSyncExternalStore, type ComponentProps } from "react";
import { useT } from "./i18n-provider";

const noop = () => () => {};

// මුරපද ක්ෂේත්‍රය + පෙන්වන/සඟවන බොත්තම. JavaScript නැති විට (SSR) බොත්තම නොපෙන්වයි; ක්ෂේත්‍රය සාමාන්‍ය password input එකක් ලෙස ක්‍රියා කරයි.
export function PasswordInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const label = shown ? t("මුරපදය සඟවන්න") : t("මුරපදය පෙන්වන්න");
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${className} ${hydrated ? "pr-12" : ""}`} />
      {hydrated && (
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={label}
          aria-pressed={shown}
          title={label}
          data-testid="toggle-password"
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition hover:text-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          {shown ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
              <path d="M1 1l22 22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

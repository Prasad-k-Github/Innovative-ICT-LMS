"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "./i18n-provider";

// බ්‍රවුසරයේ "localhost says" confirm() වෙනුවට: අපගේම තහවුරු කිරීමේ කවුළුව.
// - Esc / පිටත ඔබනවිට අවලංගු වේ; Tab focus කවුළුව තුළම රැඳේ; පෙරනිමි focus "අවලංගු" මත (අහම්බෙන් Enter ඔබා මැකීම වැළැක්වීමට)
// - verifyText ඇත්නම්: එම පෙළම ටයිප් කළ විට පමණක් "තහවුරු කරන්න" ක්‍රියාත්මක වේ (සිසුවෙකු / Admin කෙනෙකු සදහටම මකන විට)
export type ConfirmTone = "danger" | "warning";

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  tone = "danger",
  confirmLabel,
  cancelLabel,
  verifyText,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  detail?: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
  verifyText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const uid = useId();
  const [typed, setTyped] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelFn = useRef(onCancel);
  useEffect(() => {
    cancelFn.current = onCancel;
  }, [onCancel]);

  const matches = !verifyText || typed.trim().toLowerCase() === verifyText.trim().toLowerCase();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => (inputRef.current ?? cancelRef.current)?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelFn.current();
        return;
      }
      if (e.key !== "Tab" || !boxRef.current) return;
      const f = Array.from(boxRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, a[href]"));
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const danger = tone === "danger";
  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-navy-950/60 p-4 backdrop-blur-sm sm:items-center"
      data-testid="confirm-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-sun-soft text-amber-700"}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-t`} className="font-display text-lg font-bold text-navy" data-testid="confirm-title">
              {title ?? t("ඔබට විශ්වාසද?")}
            </h2>
            <p id={`${uid}-d`} className="mt-1.5 break-words text-sm leading-relaxed text-muted" data-testid="confirm-message">
              {message}
            </p>
            {detail && (
              <p className="mt-2 text-sm font-semibold text-navy" data-testid="confirm-detail">
                {detail}
              </p>
            )}
          </div>
        </div>

        {verifyText && (
          <div className="mt-4">
            <label htmlFor={`${uid}-v`} className="mb-1 block text-sm text-navy">
              {t("තහවුරු කිරීමට පහත පෙළ ටයිප් කරන්න:")} <strong className="select-all break-all rounded bg-slate-100 px-1.5 py-0.5" data-testid="confirm-phrase">{verifyText}</strong>
            </label>
            <input
              ref={inputRef}
              id={`${uid}-v`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches) onConfirm();
                }
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              data-testid="confirm-input"
              className="block w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink focus:border-red-400 focus:outline-none focus:ring-4 focus:ring-red-100"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} data-testid="confirm-cancel" className="min-h-11 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-navy transition hover:bg-slate-50">
            {cancelLabel ?? t("අවලංගු කරන්න")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches}
            data-testid="confirm-ok"
            className={`min-h-11 rounded-xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
          >
            {confirmLabel ?? t("තහවුරු කරන්න")}
          </button>
        </div>
      </div>
    </div>
  );
}

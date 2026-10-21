"use client";

import { useFormStatus } from "react-dom";
import { useT } from "./i18n-provider";
import { btnPrimary } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  className = btnPrimary,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          {t(pendingText ?? "රැඳී සිටින්න...")}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

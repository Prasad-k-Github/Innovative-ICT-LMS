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
      {pending ? t(pendingText ?? "රැඳී සිටින්න...") : children}
    </button>
  );
}

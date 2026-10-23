"use client";

import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmTone } from "./confirm-dialog";

// බොත්තම ඔබන විට අපගේම තහවුරු කිරීමේ කවුළුවක් පෙන්වයි (මකා දැමීම වැනි ක්‍රියා සඳහා). තහවුරු කළ පසු form එක මෙම බොත්තම submitter ලෙස යවයි.
// verifyText: සදහටම මකන විට ටයිප් කළ යුතු පෙළ; selectedSelector: තෝරාගත් අයිතම ගණන කවුළුවේ පෙන්වයි (0 නම් කවුළුවක් නැතිව server පණිවිඩය පෙන්වයි)
export function ConfirmButton({
  message,
  formAction,
  name,
  value,
  className,
  children,
  title,
  confirmLabel,
  verifyText,
  tone = "danger",
  selectedSelector,
  selectedTemplate,
  testId,
}: {
  message: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  className?: string;
  children: ReactNode;
  title?: string;
  confirmLabel?: string;
  verifyText?: string;
  tone?: ConfirmTone;
  selectedSelector?: string;
  selectedTemplate?: string; // උදා: "තෝරාගත් සිසුන් {n}ක්"
  testId?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const submit = () => {
    const b = ref.current;
    if (b?.form) b.form.requestSubmit(b);
  };

  return (
    <>
      <button
        ref={ref}
        type="submit"
        formAction={formAction}
        name={name}
        value={value}
        className={className}
        data-testid={testId}
        onClick={(e) => {
          e.preventDefault();
          let n: number | null = null;
          if (selectedSelector) n = ref.current?.form?.querySelectorAll(selectedSelector).length ?? 0;
          if (n === 0) return submit(); // කිසිවක් තෝරා නැත: server පණිවිඩය පෙන්වයි
          setCount(n);
          setOpen(true);
        }}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        message={message}
        detail={count !== null && selectedTemplate ? selectedTemplate.replace("{n}", String(count)) : undefined}
        tone={tone}
        confirmLabel={confirmLabel}
        verifyText={verifyText}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          // dialog එක වැසීමෙන් පසු (focus ආපසු ගිය පසු) submit කරයි
          setTimeout(submit, 0);
        }}
      />
    </>
  );
}

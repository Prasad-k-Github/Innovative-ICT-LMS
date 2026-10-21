"use client";

import type { ReactNode } from "react";

// බොත්තම ඔබන විට තහවුරු කිරීමේ පණිවිඩයක් පෙන්වයි (මකා දැමීම වැනි ක්‍රියා සඳහා)
export function ConfirmButton({
  message,
  formAction,
  name,
  value,
  className,
  children,
}: {
  message: string;
  formAction: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

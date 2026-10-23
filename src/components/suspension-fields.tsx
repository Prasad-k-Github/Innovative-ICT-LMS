"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

// අත්හිටුවීමේ කාලය (තාවකාලික / ස්ථිර) සහ හේතුව: studentsAction("suspend") මගින් කියවයි
export type SuspensionLabels = {
  duration: string;
  days: Record<number, string>;
  custom: string;
  permanent: string;
  until: string;
  reason: string;
  reasonPlaceholder: string;
};

import { SUSPEND_DAY_OPTIONS as DAYS } from "@/lib/suspension-config";

export function SuspensionFields({ labels, compact = false, minDate }: { labels: SuspensionLabels; compact?: boolean; minDate: string }) {
  const [duration, setDuration] = useState("7");
  const field = compact ? "min-h-11 rounded-xl border border-line bg-white px-3 text-sm" : inputClass;
  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "grid gap-3 sm:grid-cols-2"}>
      <select name="duration" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label={labels.duration} data-testid="suspend-duration" className={field}>
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {labels.days[d]}
          </option>
        ))}
        <option value="custom">{labels.custom}</option>
        <option value="permanent">{labels.permanent}</option>
      </select>
      {duration === "custom" && (
        <input type="date" name="until" min={minDate} required aria-label={labels.until} data-testid="suspend-until" className={field} />
      )}
      <input
        type="text"
        name="reason"
        maxLength={200}
        aria-label={labels.reason}
        placeholder={labels.reasonPlaceholder}
        data-testid="suspend-reason"
        className={`${field} ${compact ? "w-48" : "sm:col-span-2"}`}
      />
    </div>
  );
}

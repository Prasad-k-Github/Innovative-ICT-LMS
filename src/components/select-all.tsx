"use client";

// ලැයිස්තුවේ සියලු "ids" checkboxes එකවර තෝරන්න / ඉවත් කරන්න
export function SelectAll({ label }: { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        className="h-6 w-6 accent-primary"
        onChange={(e) => {
          const form = e.currentTarget.closest("form");
          form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => {
            c.checked = e.currentTarget.checked;
          });
        }}
      />
      {label}
    </label>
  );
}

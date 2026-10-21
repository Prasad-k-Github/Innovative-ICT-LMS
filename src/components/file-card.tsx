import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/constants";
import type { resources } from "@/db/schema";
import { RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";

type FileRow = typeof resources.$inferSelect;

export function FileCard({ f, type, t }: { f: FileRow; type: ContentType; t: (k: string) => string }) {
  const tone = RESOURCE_TONE[type];
  return (
    <a
      href={f.driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-file
      className="group flex min-h-[4.25rem] items-center gap-3.5 rounded-2xl border border-line bg-white p-3 pr-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_14px_28px_-18px_rgb(10_92_194/0.55)]"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${tone.tile}`} aria-hidden="true">
        {RESOURCE_ICON[type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-navy">{f.title || t(CONTENT_TYPE_LABELS[type])}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {f.year && <span className={`rounded-full px-2 py-0.5 font-semibold ${tone.chip}`}>{f.year}</span>}
          <span>Google Drive</span>
        </span>
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted transition group-hover:bg-primary group-hover:text-white" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}


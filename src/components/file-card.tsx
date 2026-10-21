import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/constants";
import type { resources } from "@/db/schema";
import { TONES } from "@/components/cards";
import { RESOURCE_COLOR, RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";

type FileRow = typeof resources.$inferSelect;

export function FileCard({ f, type, t }: { f: FileRow; type: ContentType; t: (k: string) => string }) {
  const tone = RESOURCE_TONE[type];
  const c = TONES[RESOURCE_COLOR[type]];
  return (
    <a
      href={f.driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-file
      className={`card group relative flex min-h-[4.5rem] items-center gap-3.5 overflow-hidden p-3 pl-5 pr-4 transition hover:-translate-y-0.5 ${c.glow}`}
    >
      <span className={`pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${c.bar}`} aria-hidden="true" />
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ${c.tile}`} aria-hidden="true">
        {RESOURCE_ICON[type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-navy">{f.title || t(CONTENT_TYPE_LABELS[type])}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-muted">
          {f.year && <span className={`rounded-full px-2 py-0.5 font-semibold ${tone.chip}`}>{f.year}</span>}
          <span>Google Drive</span>
        </span>
      </span>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition group-hover:translate-x-0.5 ${c.soft}`} aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

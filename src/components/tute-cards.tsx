import { Icon } from "@/components/icons";
import { Tile, TONES, ToneCard, toneAt } from "@/components/cards";
import { CONTENT_TYPE_LABELS, TUTE_TYPES, type ContentType } from "@/lib/constants";
import type { T } from "@/lib/i18n/core";
import { RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";

// සිසුන්ට පෙනෙන Tute කාඩ්පත් (Dashboard සහ /dashboard/tutes හි පොදුවේ)
export function TuteCards({
  tutes,
  files,
  t,
  heading: H = "h3",
  gradeTags,
}: {
  heading?: "h2" | "h3";
  // O/L 10 සහ 11 සිසුන්ට: tute id → "10 ශ්‍රේණිය" වැනි ලකුණ
  gradeTags?: Record<string, string>;
  tutes: { id: string; title: string; order: number }[];
  files: { lessonId: string | null; type: ContentType }[];
  t: T;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tutes.map((l) => {
        const items = files.filter((f) => f.lessonId === l.id);
        const chips = TUTE_TYPES.map((type) => ({ type, n: items.filter((i) => i.type === type).length })).filter((c) => c.n > 0);
        const tone = toneAt(l.order - 1);
        return (
          <ToneCard key={l.id} tone={tone} href={`/dashboard/tutes/${l.id}`} data-tute={l.id} className="flex flex-col p-5 pt-6">
            <span className={`pointer-events-none absolute -right-2 -top-5 select-none font-display text-8xl font-extrabold leading-none transition ${TONES[tone].mark}`} aria-hidden="true">
              {l.order}
            </span>
            <div className="relative flex items-center gap-3">
              <Tile icon="layers" tone={tone} />
              <p className="text-xs font-bold text-navy/70">{gradeTags?.[l.id] ? `${gradeTags[l.id]} · ` : ""}{t("Tute {n}", { n: l.order })}</p>
            </div>
            <H className="relative mt-3 min-h-[3rem] pr-8 font-semibold leading-snug text-navy">{l.title}</H>
            <div className="relative mt-4 flex flex-wrap gap-1.5">
              {chips.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted">{t("ඉක්මනින්")}</span>
              ) : (
                chips.map((c) => (
                  <span key={c.type} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${RESOURCE_TONE[c.type].chip}`}>
                    <span aria-hidden="true">{RESOURCE_ICON[c.type]}</span>
                    {t(CONTENT_TYPE_LABELS[c.type])} · {c.n}
                  </span>
                ))
              )}
            </div>
            <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              {t("Tute එක විවෘත කරන්න")}
              <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </ToneCard>
        );
      })}
    </div>
  );
}

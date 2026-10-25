import Link from "next/link";
import { gradeLabel } from "@/lib/constants";
import type { T } from "@/lib/i18n/core";

// O/L ශ්‍රේණි 10 සහ 11 බෙදාගන්නා විට: පෙරනිමිය සිසුවාගේ ම ශ්‍රේණිය; `?g=<ශ්‍රේණිය>` වෙනත් ශ්‍රේණියක්; `?g=all` දෙකම
export function pickGrade(raw: string | string[] | undefined, group: number[], own: number): number | null {
  if (group.length < 2) return null;
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (r === "all") return null;
  const v = Number(r);
  return group.includes(v) ? v : own;
}

export function GradeTabs({
  group,
  current,
  own,
  counts,
  basePath,
  t,
}: {
  group: number[];
  current: number | null;
  own: number;
  counts: Record<number, number>;
  basePath: string;
  t: T;
}) {
  if (group.length < 2) return null;
  const total = group.reduce((s, g) => s + (counts[g] ?? 0), 0);
  const tabs: { key: string; g: number | null; label: string; n: number }[] = [
    // සිසුවාගේ ශ්‍රේණිය මුලින්ම, අනෙක් ශ්‍රේණිය ඊළඟට, "සියල්ල" අවසානයේ
    ...[...group].sort((a, b) => Number(b === own) - Number(a === own) || a - b).map((g) => ({ key: String(g), g: g as number | null, label: gradeLabel(g, null, t), n: counts[g] ?? 0 })),
    { key: "all", g: null, label: t("සියල්ල"), n: total },
  ];
  return (
    <nav aria-label={t("ශ්‍රේණිය")} data-testid="grade-tabs" className="flex flex-wrap gap-1.5">
      {tabs.map((x) => {
        const active = x.g === current;
        return (
          <Link
            key={x.key}
            href={`${basePath}?g=${x.g === null ? "all" : x.g}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            data-grade-tab={x.key}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
              active ? "bg-primary text-white shadow-sm" : "bg-white text-navy ring-1 ring-slate-200 hover:ring-primary/50"
            }`}
          >
            {x.label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/20" : "bg-slate-100 text-muted"}`}>{x.n}</span>
          </Link>
        );
      })}
    </nav>
  );
}

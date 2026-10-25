import Link from "next/link";
import { gradeLabel } from "@/lib/constants";
import type { T } from "@/lib/i18n/core";

// O/L ශ්‍රේණි 10 සහ 11 බෙදාගන්නා විට, `?g=10` / `?g=11` මගින් එක් ශ්‍රේණියක් පමණක් පෙන්වීමට
export function pickGrade(raw: string | string[] | undefined, group: number[]): number | null {
  if (group.length < 2) return null;
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return group.includes(v) ? v : null;
}

export function GradeTabs({
  group,
  current,
  counts,
  basePath,
  t,
}: {
  group: number[];
  current: number | null;
  counts: Record<number, number>;
  basePath: string;
  t: T;
}) {
  if (group.length < 2) return null;
  const total = group.reduce((s, g) => s + (counts[g] ?? 0), 0);
  const tabs: { key: string; g: number | null; label: string; n: number }[] = [
    { key: "all", g: null, label: t("සියල්ල"), n: total },
    ...group.map((g) => ({ key: String(g), g, label: gradeLabel(g, null, t), n: counts[g] ?? 0 })),
  ];
  return (
    <nav aria-label={t("ශ්‍රේණිය")} data-testid="grade-tabs" className="flex flex-wrap gap-1.5">
      {tabs.map((x) => {
        const active = x.g === current;
        return (
          <Link
            key={x.key}
            href={x.g === null ? basePath : `${basePath}?g=${x.g}`}
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

import { Icon } from "./icons";

type Row = { label: string; value: string };

// Email තහවුරු කර Admin අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුවාට dashboard හි පෙන්වන පණිවිඩය
export function PendingNotice({
  name,
  rows,
  t,
}: {
  name: string;
  rows: Row[];
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const steps = [
    { label: "ලියාපදිංචි විය", done: true },
    { label: "Email ලිපිනය තහවුරු විය.", done: true },
    { label: "මුරපදය සාදා ඇත", done: true },
    { label: "Admin අනුමැතිය බලාපොරොත්තුවෙන්", done: false },
  ];
  return (
    <div className="space-y-6">
      <section className="pixel-grid relative overflow-hidden rounded-[1.75rem] bg-navy-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sun/25 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-sun px-3 py-1 text-sm font-bold text-navy">
            <span className="h-2 w-2 animate-pulse rounded-full bg-navy motion-reduce:animate-none" aria-hidden="true" />
            {t("අනුමැතිය බලාපොරොත්තුවෙන්")}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">{t("ආයුබෝවන්, {name}", { name })}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/80">
            {t("ඔබගේ ගිණුම Admin අනුමත කරන තෙක් රැඳී සිටින්න. අනුමත වූ පසු ඔබගේ පාඩම්, පැවරුම් සහ Quiz මෙහි විවෘත වේ.")}
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-xl font-bold">{t("ඔබගේ ලියාපදිංචිය")}</h2>
          <ol className="mt-5">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex items-center gap-4 pb-5 last:pb-0">
                {i < steps.length - 1 && <span className={`absolute left-[15px] top-9 h-[calc(100%-2rem)] w-px ${s.done ? "bg-emerald-300" : "bg-line"}`} aria-hidden="true" />}
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    s.done ? "bg-emerald-500 text-white" : "border-2 border-sun bg-sun-soft text-amber-800"
                  }`}
                >
                  {s.done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                </span>
                <span className={s.done ? "font-medium text-ink" : "font-bold text-amber-900"}>{t(s.label)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card p-6">
          <h2 className="text-xl font-bold">{t("ඔබ ලබා දුන් තොරතුරු")}</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted">{t(r.label)}</dt>
                <dd className="break-words font-medium sm:text-right">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-xl bg-sun-soft px-4 py-3 text-sm leading-relaxed text-amber-950">
            {t("තොරතුරු වැරදි නම් හෝ ඉක්මනින් අනුමත කර ගැනීමට, ඔබගේ පන්ති ගුරුවරයා / ආයතනය අමතන්න.")}
          </p>
          <a href="/dashboard" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold hover:border-primary/40 hover:bg-primary-soft">
            {t("නැවත පරීක්ෂා කරන්න")}
          </a>
        </section>
      </div>
    </div>
  );
}

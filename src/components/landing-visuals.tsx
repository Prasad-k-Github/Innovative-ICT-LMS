import { Icon } from "@/components/icons";

// Landing page හි සැරසිලි / නිදර්ශන දෘශ්‍ය (සියල්ලම aria-hidden: තොරතුරු රහිත, අලංකාරය පමණි)

// ICT හි පික්සල් සංකේතය: පාට කුඩා කොටු ජාලයක් (ඡායාරූපය පිටුපස)
export function PixelBlocks({ className = "" }: { className?: string }) {
  // [පේළිය, තීරුව, පාට]
  const cells: [number, number, string][] = [
    [0, 3, "bg-sun"], [1, 2, "bg-sun/70"], [1, 3, "bg-primary-bright"], [2, 1, "bg-sun/40"], [2, 2, "bg-primary-bright/70"], [2, 3, "bg-white/25"],
    [3, 0, "bg-sun/30"], [3, 1, "bg-primary-bright/50"], [3, 2, "bg-white/20"], [4, 0, "bg-primary-bright/40"], [4, 1, "bg-white/15"], [5, 0, "bg-accent/80"],
  ];
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`} aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => {
        const r = Math.floor(i / 4), c = i % 4;
        const hit = cells.find(([cr, cc]) => cr === r && cc === c);
        return <span key={i} className={`h-5 w-5 rounded-md sm:h-6 sm:w-6 ${hit ? hit[2] : "bg-transparent"}`} />;
      })}
    </div>
  );
}

// HD Recordings: video player නිදර්ශනය
export function RecordingMock() {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-navy-950 shadow-[0_24px_40px_-24px_rgb(10_92_194/0.9)] ring-1 ring-white/20" aria-hidden="true">
      <div className="pixel-grid absolute inset-0 opacity-70" />
      <span className="absolute left-3 top-3 rounded-md bg-sun px-1.5 py-0.5 text-[0.65rem] font-extrabold text-navy">HD</span>
      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-xl">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
        </svg>
      </span>
      <div className="absolute inset-x-4 bottom-3 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
          <span className="block h-full w-2/5 rounded-full bg-sun" />
        </span>
        <span className="h-1.5 w-8 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

// Model Papers & Quiz: ප්‍රශ්නයක් සහ පිළිතුරු නිදර්ශනය
export function QuizMock() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_24px_40px_-24px_rgb(11_22_51/0.45)] ring-1 ring-navy/10" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="h-2.5 w-24 rounded-full bg-navy/80" />
        <span className="h-2.5 w-10 rounded-full bg-sun" />
      </div>
      <span className="mt-3 block h-2 w-5/6 rounded-full bg-navy/15" />
      <div className="mt-3 space-y-2">
        {[false, true, false].map((on, i) => (
          <div key={i} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${on ? "border-primary bg-primary-soft" : "border-line"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-primary bg-primary text-white" : "border-navy/20"}`}>
              {on && <Icon name="check" className="h-3 w-3" />}
            </span>
            <span className={`h-2 rounded-full ${on ? "w-20 bg-primary/60" : "w-16 bg-navy/15"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Smart Assignments & Notes: ලැයිස්තු නිදර්ශනය
export function NotesMock() {
  return (
    <div className="space-y-2.5 rounded-2xl bg-white p-4 shadow-[0_24px_40px_-24px_rgb(180_120_0/0.5)] ring-1 ring-navy/10" aria-hidden="true">
      {[
        { icon: "clipboard" as const, bar: "w-28", done: true },
        { icon: "papers" as const, bar: "w-24", done: false },
        { icon: "book" as const, bar: "w-32", done: false },
      ].map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${i === 0 ? "bg-sun text-navy" : "bg-surface text-primary"}`}>
            <Icon name={r.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className={`block h-2 rounded-full bg-navy/70 ${r.bar}`} />
            <span className="block h-1.5 w-1/2 rounded-full bg-navy/15" />
          </span>
          {r.done ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="h-6 w-6 rounded-full border-2 border-navy/15" />
          )}
        </div>
      ))}
    </div>
  );
}

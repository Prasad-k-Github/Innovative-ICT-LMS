import type { ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icons";

// ඉතා විචිත්‍රවත් card පද්ධතිය: සෑම card එකකටම වර්ණයක් (tone) ඇත — ඉහළ ඉරක්, gradient icon කොටුවක්, chip සහ hover දීප්තිය.
export type Tone = "blue" | "red" | "sun" | "green" | "violet" | "cyan";

export const TONES: Record<Tone, { bar: string; tile: string; soft: string; mark: string; glow: string; ring: string }> = {
  blue: {
    bar: "from-primary to-primary-bright",
    tile: "from-primary to-primary-bright text-white shadow-[0_10px_18px_-10px_rgb(10_92_194/0.9)]",
    soft: "bg-primary-soft text-primary",
    mark: "text-primary/10 group-hover:text-primary/20",
    glow: "hover:border-primary/40 hover:shadow-[0_20px_36px_-20px_rgb(10_92_194/0.65)]",
    ring: "ring-primary/20",
  },
  red: {
    bar: "from-accent to-orange-400",
    tile: "from-accent to-orange-400 text-white shadow-[0_10px_18px_-10px_rgb(230_0_8/0.8)]",
    soft: "bg-accent-soft text-accent",
    mark: "text-accent/10 group-hover:text-accent/20",
    glow: "hover:border-accent/40 hover:shadow-[0_20px_36px_-20px_rgb(230_0_8/0.55)]",
    ring: "ring-accent/20",
  },
  sun: {
    bar: "from-sun to-amber-500",
    tile: "from-sun to-amber-400 text-navy shadow-[0_10px_18px_-10px_rgb(217_119_6/0.9)]",
    soft: "bg-sun-soft text-amber-800",
    mark: "text-amber-500/15 group-hover:text-amber-500/25",
    glow: "hover:border-amber-400/60 hover:shadow-[0_20px_36px_-20px_rgb(217_119_6/0.6)]",
    ring: "ring-amber-400/30",
  },
  green: {
    bar: "from-emerald-500 to-teal-400",
    tile: "from-emerald-500 to-teal-400 text-white shadow-[0_10px_18px_-10px_rgb(5_150_105/0.9)]",
    soft: "bg-emerald-50 text-emerald-700",
    mark: "text-emerald-500/10 group-hover:text-emerald-500/20",
    glow: "hover:border-emerald-400/50 hover:shadow-[0_20px_36px_-20px_rgb(5_150_105/0.6)]",
    ring: "ring-emerald-400/25",
  },
  violet: {
    bar: "from-violet-600 to-fuchsia-500",
    tile: "from-violet-600 to-fuchsia-500 text-white shadow-[0_10px_18px_-10px_rgb(124_58_237/0.9)]",
    soft: "bg-violet-50 text-violet-700",
    mark: "text-violet-500/10 group-hover:text-violet-500/20",
    glow: "hover:border-violet-400/50 hover:shadow-[0_20px_36px_-20px_rgb(124_58_237/0.6)]",
    ring: "ring-violet-400/25",
  },
  cyan: {
    bar: "from-cyan-600 to-sky-400",
    tile: "from-cyan-600 to-sky-400 text-white shadow-[0_10px_18px_-10px_rgb(8_145_178/0.9)]",
    soft: "bg-cyan-50 text-cyan-700",
    mark: "text-cyan-500/10 group-hover:text-cyan-500/20",
    glow: "hover:border-cyan-400/50 hover:shadow-[0_20px_36px_-20px_rgb(8_145_178/0.6)]",
    ring: "ring-cyan-400/25",
  },
};

const CYCLE: Tone[] = ["blue", "red", "sun", "green", "violet", "cyan"];
// අංකයකට (පාඩම් අංකය, index ආදිය) අනුව වර්ණයක් — සෑම විටම එකම අංකයට එකම වර්ණය
export const toneAt = (n: number): Tone => CYCLE[Math.abs(Math.trunc(n)) % CYCLE.length];
// නමකට අනුව (avatar සඳහා)
export const toneOfText = (s: string): Tone => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return toneAt(h);
};

// card එකේ පොදු ශෛලිය: ඉහළ වර්ණ ඉර + hover lift. href දුන්නොත් Link, නැත්නම් div.
export function ToneCard({
  tone = "blue",
  href,
  className = "",
  children,
  ...rest
}: {
  tone?: Tone;
  href?: string;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const t = TONES[tone];
  const cls = `card group relative block overflow-hidden pt-5 transition ${href ? `hover:-translate-y-0.5 ${t.glow}` : ""} ${className}`;
  const bar = <span className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${t.bar}`} aria-hidden="true" />;
  return href ? (
    <Link href={href} className={cls} {...rest}>
      {bar}
      {children}
    </Link>
  ) : (
    <div className={cls} {...rest}>
      {bar}
      {children}
    </div>
  );
}

// gradient පසුබිම සහිත icon කොටුව
export function Tile({ icon, tone = "blue", size = "md" }: { icon: IconName; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 rounded-2xl" : size === "sm" ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-xl";
  const ic = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${dim} ${TONES[tone].tile}`} aria-hidden="true">
      <Icon name={icon} className={ic} />
    </span>
  );
}

// නමේ මුල් අකුර සහිත වටකුරු avatar
export function Avatar({ name, tone, size = "md" }: { name: string; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const tn = tone ?? toneOfText(name);
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  const dim = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-8 w-8 text-sm" : "h-11 w-11 text-base";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-bold ${dim} ${TONES[tn].tile}`} aria-hidden="true">
      {initial}
    </span>
  );
}

// කුඩා වර්ණ chip
export function Chip({ tone = "blue", icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone].soft}`}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

// ඉහළ කොටසේ ගණන් පෙන්වන, gradient පසුබිම සහිත stat card
export function StatCard({ icon, tone = "blue", value, label, href }: { icon: IconName; tone?: Tone; value: ReactNode; label: string; href?: string }) {
  const t = TONES[tone];
  const body = (
    <>
      <span className={`pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full bg-gradient-to-br opacity-15 ${t.bar}`} aria-hidden="true" />
      <Tile icon={icon} tone={tone} />
      <p className="mt-4 font-display text-4xl font-bold leading-none text-navy">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-muted">{label}</p>
    </>
  );
  const cls = `card group relative block overflow-hidden p-5 transition ${href ? `hover:-translate-y-0.5 ${t.glow}` : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

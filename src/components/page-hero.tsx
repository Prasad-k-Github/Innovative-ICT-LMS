import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// සියලු ඇතුළත පිටු (Student + Admin) සඳහා එකම navy "hero" header එක
export const heroBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sun px-4 text-sm font-bold text-navy shadow-[0_10px_20px_-12px_rgb(255_196_46/0.9)] transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-sun/40";
export const heroBtnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30";

export function PageHero({
  title,
  subtitle,
  back,
  icon,
  badges,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  icon?: IconName;
  badges?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="pixel-grid relative overflow-hidden rounded-[1.75rem] bg-navy-950 p-5 text-white sm:p-7" data-testid="page-hero">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
      <div className="relative">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white">
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {icon && (
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sun ring-1 ring-white/10 sm:flex">
                <Icon name={icon} className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl [overflow-wrap:anywhere]">{title}</h1>
              {badges && <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm font-semibold">{badges}</div>}
              {subtitle && <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/70">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </section>
  );
}

// hero මත පෙන්වන කුඩා badge (සුදු/කහ)
export function HeroBadge({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "sun" }) {
  return <span className={`rounded-full px-3 py-1 ${tone === "sun" ? "bg-sun text-navy" : "bg-white/10 text-white"}`}>{children}</span>;
}

export function EmptyState({ children, icon = "layers" }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p>{children}</p>
    </div>
  );
}

// ලැයිස්තු අයිතම සඳහා card (hover lift)
export const listCard =
  "card block p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_18px_34px_-20px_rgb(10_92_194/0.6)] sm:p-5";

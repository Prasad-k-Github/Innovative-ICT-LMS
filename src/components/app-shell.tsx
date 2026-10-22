"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { useLang, useT } from "./i18n-provider";
import { Icon, type IconName } from "./icons";
import { LogoutButton } from "./logout-button";
import { BellButton, NotificationsProvider } from "./notifications";
import type { NotificationsPayload } from "@/lib/notifications-data";
import { Logo } from "./ui";
import { AGENT_FULL_PATH } from "@/lib/agent-config";

// Side panel එක සඟවා/පෙන්වීමේ තේරීම (සියලු පිටු) (browser එකේ මතක තබා ගනී; ගබඩාව නොමැති විටද මෙම tab එකේ ක්‍රියා කරයි)
const SIDEBAR_KEY = "ict_sidebar_hidden";
let hiddenMem: boolean | null = null;
const hiddenListeners = new Set<() => void>();
const getHidden = () => {
  if (hiddenMem === null) {
    try {
      hiddenMem = localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      hiddenMem = false;
    }
  }
  return hiddenMem;
};
const subscribeHidden = (cb: () => void) => {
  hiddenListeners.add(cb);
  return () => void hiddenListeners.delete(cb);
};
const setHiddenPref = (v: boolean) => {
  hiddenMem = v;
  try {
    localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0");
  } catch {
    /* ගබඩාව නොමැති විට මතකයේ පමණක් */
  }
  hiddenListeners.forEach((f) => f());
};

export type ShellLink = { href: string; label: string; icon: IconName; exact?: boolean; also?: string[]; group?: string }; // group: මෙම link එකට පෙර පෙන්වන කොටස් නම

// Student සහ Admin යන දෙපාර්ශ්වයටම පොදු රාමුව: විශාල තිරයේ වම් sidebar එකක්, දුරකථනයේ drawer එකක් (DOM එකේ nav එක එකක් පමණි)
export function AppShell({
  links,
  homeHref,
  badge,
  userName,
  userSub,
  avatarSrc,
  notifications,
  children,
}: {
  links: ShellLink[];
  homeHref: string;
  badge?: string;
  userName: string;
  userSub?: string;
  avatarSrc?: string | null; // Profile ඡායාරූපය (නැත්නම් නමේ මුල් අකුර)
  notifications?: NotificationsPayload; // නැත්නම් (අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්) bell එක පෙන්වන්නේ නැත
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const initial = Array.from(userName.trim())[0]?.toUpperCase() ?? "?";
  // ICT මිතුරා: මුළු තිරයම (side panel + chat පමණි). අනෙක් පිටු වල සාමාන්‍ය රාමුව
  const full = pathname === AGENT_FULL_PATH;
  const prefHidden = useSyncExternalStore(subscribeHidden, getHidden, () => false);
  const sideHidden = prefHidden; // විශාල තිරයේ side panel එක සඟවා ඇත (සියලු පිටු වල)

  const shell = (
    <div className={`${full ? "flex h-dvh flex-col" : "min-h-dvh"} transition-[padding] duration-300 ${sideHidden ? "" : "lg:pl-72"}`}>
      {/* දුරකථන: ඉහළ තීරුව */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-navy-950 px-3 py-2.5 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("මෙනුව විවෘත කරන්න")}
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 hover:bg-white/10"
        >
          <Icon name="menu" />
        </button>
        <div className="min-w-0 flex-1 [&_span.font-display]:hidden sm:[&_span.font-display]:inline">
          <Logo href={homeHref} tone="dark" />
        </div>
        {notifications && <BellButton tone="dark" />}
        <LanguageSwitcher tone="dark" />
        <LogoutButton tone="dark" />
      </header>

      {/* විශාල තිරය: bell බොත්තම ඉහළ දකුණේ */}
      {notifications && !full && (
        <div className="fixed right-6 top-4 z-30 hidden lg:block">
          <BellButton tone="light" />
        </div>
      )}

      {/* Side panel සඟවා ඇති විට පමණක්: නැවත පෙන්වීමේ බොත්තම (සඟවන බොත්තම side panel එක ඇතුළත ඇත) */}
      {prefHidden && (
        <button
          type="button"
          onClick={() => setHiddenPref(false)}
          aria-label={t("Side panel එක පෙන්වන්න")}
          title={t("Side panel එක පෙන්වන්න")}
          aria-pressed
          data-testid="sidebar-toggle"
          className="fixed left-3 top-3.5 z-[60] hidden h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/90 text-navy shadow-sm backdrop-blur transition hover:bg-primary-soft lg:flex"
        >
          <Icon name="panel-show" className="h-5 w-5" />
        </button>
      )}

      {open && <div className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        data-sidebar={sideHidden ? "hidden" : "shown"}
        className={`pixel-grid fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-navy-950 text-white transition-[transform,visibility] duration-300 ${
          sideHidden ? "lg:invisible lg:-translate-x-full" : "lg:translate-x-0"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-6">
          <Logo href={homeHref} tone="dark" />
          {/* Desktop: side panel එක සඟවන බොත්තම (panel එක ඇතුළත) */}
          {!prefHidden && (
            <button
              type="button"
              onClick={() => setHiddenPref(true)}
              aria-label={t("Side panel එක සඟවන්න")}
              title={t("Side panel එක සඟවන්න")}
              aria-pressed={false}
              data-testid="sidebar-toggle"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-white/80 transition hover:bg-white/10 hover:text-white lg:flex"
            >
              <Icon name="panel-hide" className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("මෙනුව වසන්න")}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        {badge && (
          <div className="px-5 pb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-xs font-bold text-navy">
              <Icon name="shield" className="h-3.5 w-3.5" />
              {badge}
            </span>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
          {links.map((l) => {
            const active = l.exact ? pathname === l.href || !!l.also?.some((p) => pathname.startsWith(p)) : pathname.startsWith(l.href);
            return (
              <div key={l.href}>
                {l.group && <p className="px-3.5 pb-1 pt-4 text-xs font-semibold tracking-wide text-white/45">{t(l.group)}</p>}
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition ${
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
                }`}
              >
                {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-sun" aria-hidden="true" />}
                <Icon name={l.icon} className={`h-5 w-5 shrink-0 ${active ? "text-sun" : "text-white/55 group-hover:text-white/80"}`} />
                <span className="min-w-0 truncate">{t(l.label)}</span>
              </Link>
              </div>
            );
          })}
        </nav>

        {/* පරිශීලක කාඩ්පත (විශාල තිරයේ පමණි) */}
        <div className="m-3 hidden rounded-2xl border border-white/10 bg-white/5 p-3 lg:block">
          <div className="flex items-center gap-3">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" data-avatar-photo className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-sun" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sun font-display text-base font-bold text-navy">{initial}</span>
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{userName}</p>
              {userSub && <p className="mt-0.5 truncate text-xs text-white/60">{userSub}</p>}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <LanguageSwitcher tone="dark" />
            <LogoutButton tone="dark" />
          </div>
        </div>
        <div className="m-3 rounded-2xl border border-white/10 bg-white/5 p-3 lg:hidden">
          <p className="truncate text-sm font-semibold">{userName}</p>
          {userSub && <p className="mt-0.5 truncate text-xs text-white/60">{userSub}</p>}
        </div>
      </aside>

      {full ? (
        <main className="min-h-0 flex-1" data-fullscreen="agent">
          {children}
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[100rem] px-3 py-5 sm:px-4 lg:px-6 lg:pb-8 lg:pt-[4.75rem]">{children}</main>
      )}
    </div>
  );

  return notifications ? (
    <NotificationsProvider key={lang} initial={notifications}>
      {shell}
    </NotificationsProvider>
  ) : (
    shell
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { useLang, useT } from "./i18n-provider";
import { Icon, type IconName } from "./icons";
import { LogoutButton } from "./logout-button";
import { BellButton, NotificationsProvider, useOptionalNotif } from "./notifications";
import type { NotificationsPayload } from "@/lib/notifications-data";
import { AgentLogo } from "./cards";
import { ChatDock, useDockOpen, type DockConfig } from "./chat-dock";
import { SessionGuard } from "./session-guard";
import { Logo } from "./ui";
import { AGENT_FULL_PATHS, ASSISTANT_PATH } from "@/lib/agent-config";

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

const isActiveLink = (l: ShellLink, path: string) => (l.exact ? path === l.href || !!l.also?.some((p) => path.startsWith(p)) : path.startsWith(l.href));

// පැති මෙනුව: සෑම කොටසකටම අලුත් යාවත්කාලීන ගණන (Notification එකේ ආකාරයටම). කොටසට ගිය පසු එම අංකය ඉවත් වේ
function NavList({ links, pathname, onNavigate }: { links: ShellLink[]; pathname: string; onNavigate: () => void }) {
  const t = useT();
  const notif = useOptionalNotif();
  const items = notif?.data.items;
  const markMany = notif?.markMany;
  // නොකියවූ දැනුම්දීම් → අදාළ මෙනු කොටස (දැනුම්දීමේ link එක අයත් වන කොටස)
  const byLink = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of items ?? []) {
      if (n.read) continue;
      const path = n.href.split(/[?#]/)[0];
      const l = links.find((x) => isActiveLink(x, path));
      if (l) m.set(l.href, [...(m.get(l.href) ?? []), n.id]);
    }
    return m;
  }, [items, links]);
  const current = links.find((l) => isActiveLink(l, pathname));
  const seenKey = current ? (byLink.get(current.href) ?? []).join(",") : "";
  // බලමින් සිටින කොටසේ අංක තත්පරයකට පසු ඉවත් කරයි
  useEffect(() => {
    if (!seenKey || !markMany) return;
    const id = setTimeout(() => markMany(seenKey.split(",")), 1200);
    return () => clearTimeout(id);
  }, [seenKey, markMany]);

  return (
    <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
      {links.map((l) => {
        const active = isActiveLink(l, pathname);
        const n = byLink.get(l.href)?.length ?? 0;
        return (
          <div key={l.href}>
            {l.group && <p className="px-3.5 pb-1 pt-4 text-xs font-semibold tracking-wide text-white/45">{t(l.group)}</p>}
            <Link
              href={l.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition ${
                active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
              }`}
            >
              {active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-sun" aria-hidden="true" />}
              <Icon name={l.icon} className={`h-5 w-5 shrink-0 ${active ? "text-sun" : "text-white/55 group-hover:text-white/80"}`} />
              <span className="min-w-0 flex-1 truncate">{t(l.label)}</span>
              {n > 0 && (
                <span
                  data-testid="nav-badge"
                  data-nav-badge={l.href}
                  aria-label={t("අලුත් යාවත්කාලීන {n}", { n })}
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-white"
                >
                  {n > 99 ? "99+" : n}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

// Student සහ Admin යන දෙපාර්ශ්වයටම පොදු රාමුව: විශාල තිරයේ වම් sidebar එකක්, දුරකථනයේ drawer එකක් (DOM එකේ nav එක එකක් පමණි)
export function AppShell({
  links,
  homeHref,
  badge,
  userName,
  userSub,
  avatarSrc,
  notifications,
  chat,
  agentHref,
  children,
}: {
  links: ShellLink[];
  homeHref: string;
  badge?: string;
  userName: string;
  userSub?: string;
  avatarSrc?: string | null; // Profile ඡායාරූපය (නැත්නම් නමේ මුල් අකුර)
  notifications?: NotificationsPayload; // නැත්නම් (අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්) bell එක පෙන්වන්නේ නැත
  chat?: DockConfig; // පැත්තේ Live chat dock එක (නැත්නම් පෙන්වන්නේ නැත)
  agentHref?: string; // ICT මිතුරාට යන, සෑම පිටුවකම නිතර පෙනෙන බොත්තම (නැත්නම් පෙන්වන්නේ නැත)
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
  const full = AGENT_FULL_PATHS.includes(pathname);
  const prefHidden = useSyncExternalStore(subscribeHidden, getHidden, () => false);
  const dockOpen = useDockOpen();
  // Chat dock එක: ICT මිතුරා (මුළු තිරය) සහ සම්පූර්ණ chat පිටුවේදී පෙන්වන්නේ නැත
  const dockOn = !!chat && !full && !pathname.endsWith("/community/chat");
  const sideHidden = prefHidden; // විශාල තිරයේ side panel එක සඟවා ඇත (සියලු පිටු වල)

  const shell = (
    <div className={`${full ? "flex h-dvh flex-col" : "min-h-dvh"} transition-[padding] duration-300 ${sideHidden ? "" : "lg:pl-72"} ${dockOn && dockOpen ? "xl:pr-80" : ""}`}>
      <SessionGuard />
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
        <div className={`fixed right-6 top-4 z-30 hidden lg:block ${dockOn && dockOpen ? "xl:right-[21.5rem]" : ""}`}>
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

        <NavList links={links} pathname={pathname} onNavigate={() => setOpen(false)} />

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
        <main className="mx-auto w-full max-w-[100rem] px-3 pb-32 pt-5 sm:px-4 lg:px-6 lg:pt-[4.75rem]">{children}</main>
      )}

      {dockOn && chat && <ChatDock config={chat} />}

      {/* ICT මිතුරා: නිතර තිරයේ පෙනෙන බොත්තම (chat බොත්තමට ඉහළින්; chat dock එක විවෘතව ඇති විට එහි වම් පැත්තේ) */}
      {agentHref && !full && (
        <Link
          href={agentHref}
          data-testid="agent-fab"
          aria-label={t(agentHref === ASSISTANT_PATH ? "AI සහායක" : "ICT මිතුරා")}
          title={t(agentHref === ASSISTANT_PATH ? "AI සහායකයාගෙන් අහන්න" : "ICT මිතුරාගෙන් අහන්න")}
          className={`fixed z-[60] flex h-14 items-center gap-2 rounded-full border border-violet-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-bold text-navy shadow-[0_14px_28px_-12px_rgb(76_29_149/0.55)] transition hover:-translate-y-0.5 hover:border-violet-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/50 ${
            dockOn && dockOpen ? "bottom-4 right-4 xl:right-[21rem]" : dockOn ? "bottom-[5.25rem] right-4" : "bottom-4 right-4"
          }`}
        >
          <AgentLogo size="md" />
          <span className="hidden sm:inline">{t(agentHref === ASSISTANT_PATH ? "AI සහායක" : "ICT මිතුරා")}</span>
        </Link>
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

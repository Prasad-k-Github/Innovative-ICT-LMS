"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clearAllNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction, markNotificationsReadAction } from "@/app/actions/notifications";
import { DATE_LOCALE } from "@/lib/i18n/core";
import type { NotificationsPayload } from "@/lib/notifications-data";
import { useLang, useT } from "./i18n-provider";
import { Icon } from "./icons";

// Real-time ආසන්න: තත්පර 20කට වරක් (tab එක පෙනෙන විට), route මාරුවේදී සහ tab එකට ආපසු ආ විට
const POLL_MS = 20_000;
const STALE_MS = 30_000; // මෙයට වඩා වැඩි වේලාවක් සැඟවී තිබුණු tab එකකදී පිටුවේ දත්තද නවීකරණය කරයි

type Ctx = {
  data: NotificationsPayload;
  open: boolean;
  setOpen: (v: boolean) => void;
  now: number;
  status: "ok" | "loading" | "error";
  reload: () => void;
  markRead: (id: string) => void;
  markMany: (ids: string[]) => void;
  markAll: () => void;
  clearAll: () => void;
};
const NotifCtx = createContext<Ctx | null>(null);

// ශ්‍රේණිය/භාෂාව වෙනස් වන විට (key) අලුතින් පටන් ගනී. විනාඩියකට වරක් සහ tab එකට ආපසු ආ විට අලුත් දැනුම්දීම් ලබා ගනී
export function NotificationsProvider({ initial, children }: { initial: NotificationsPayload; children: ReactNode }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [status, setStatus] = useState<"ok" | "loading" | "error">("ok");
  const router = useRouter();
  const pathname = usePathname();
  // අලුත්ම දැනුම්දීමේ id: වෙනස් වුවහොත් (අලුත් දෙයක් පැමිණියහොත්) විවෘත පිටුවද නවීකරණය කරයි
  const topId = useRef<string | undefined>(initial.items[0]?.id);
  const hiddenAt = useRef(0);

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const next = (await res.json()) as NotificationsPayload;
        setData(next);
        setStatus("ok");
        setNow(Date.now());
        const top = next.items[0]?.id;
        const changed = top !== undefined && top !== topId.current;
        topId.current = top;
        if (changed || opts?.force) router.refresh();
      } catch {
        setStatus("error"); // network දෝෂය: ඊළඟ වාරයේ නැවත උත්සාහ කරයි
      }
    },
    [router],
  );

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else {
        const stale = hiddenAt.current > 0 && Date.now() - hiddenAt.current > STALE_MS;
        hiddenAt.current = 0;
        void load({ force: stale });
      }
    };
    const onFocus = () => void load();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // පිටුවක් මාරු වන විට (layout එක නැවත render නොවන නිසා) නවතම දැනුම්දීම් ලබා ගනී
  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [pathname, load]);

  // panel එක විවෘත කරන විට ඉක්මනින් නවීකරණය කරයි
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => {
        setStatus("loading");
        void load();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [open, load]);

  const markRead = useCallback((id: string) => {
    setData((d) => {
      const target = d.items.find((i) => i.id === id);
      if (!target || target.read) return d;
      return { unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === id ? { ...i, read: true } : i)) };
    });
    void markNotificationReadAction(id);
  }, []);

  // පැති මෙනුවේ කොටසක් බැලූ විට එහි නොකියවූ දැනුම්දීම් කියවූ ලෙස සලකුණු කරයි
  const markMany = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setData((d) => {
      const hit = d.items.filter((i) => set.has(i.id) && !i.read).length;
      if (hit === 0) return d;
      return { unread: Math.max(0, d.unread - hit), items: d.items.map((i) => (set.has(i.id) ? { ...i, read: true } : i)) };
    });
    void markNotificationsReadAction(ids);
  }, []);

  const markAll = useCallback(() => {
    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, read: true })) }));
    void markAllNotificationsReadAction();
  }, []);

  const clearAll = useCallback(() => {
    setData({ unread: 0, items: [] });
    // සේවාදායකයේ මැකීම අවසන් වූ පසු ද හිස්ව තබයි (අතරතුර ආ පැරණි poll එකක් නැවත පෙන්වීම වළක්වයි)
    void clearAllNotificationsAction().finally(() => setData({ unread: 0, items: [] }));
  }, []);

  const reload = useCallback(() => void load(), [load]);
  const value = useMemo(() => ({ data, open, setOpen, now, status, reload, markRead, markMany, markAll, clearAll }), [data, open, now, status, reload, markRead, markMany, markAll, clearAll]);
  return (
    <NotifCtx.Provider value={value}>
      {children}
      <NotificationPanel />
    </NotifCtx.Provider>
  );
}

function useNotif() {
  const c = useContext(NotifCtx);
  if (!c) throw new Error("NotificationsProvider missing");
  return c;
}

// Provider නැති විට (අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්) null
export function useOptionalNotif() {
  return useContext(NotifCtx);
}

export function BellButton({ tone = "dark", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const { data, open, setOpen } = useNotif();
  const t = useT();
  const cls =
    tone === "dark"
      ? "border-white/20 bg-transparent text-white hover:bg-white/10"
      : "border-line bg-white text-navy shadow-sm hover:border-primary/40 hover:bg-primary-soft";
  const shown = data.unread > 99 ? "99+" : String(data.unread);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={data.unread > 0 ? t("දැනුම්දීම් ({n} නොකියවූ)", { n: data.unread }) : t("දැනුම්දීම්")}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-testid="bell"
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition ${cls} ${className}`}
    >
      <Icon name="bell" className="h-5 w-5" />
      {data.unread > 0 && (
        <span
          data-testid="bell-badge"
          className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white ring-2 ${tone === "dark" ? "ring-navy-950" : "ring-white"}`}
        >
          {shown}
        </span>
      )}
    </button>
  );
}

function ago(iso: string, now: number, lang: "si" | "en") {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000); // සෘණ = අතීතය
  const rtf = new Intl.RelativeTimeFormat(DATE_LOCALE[lang], { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: "numeric", month: "short" }).format(new Date(iso));
}

function NotificationPanel() {
  const { data, open, setOpen, now, status, reload, markRead, markAll, clearAll } = useNotif();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const lang = useLang();
  const [mounted, setMounted] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!mounted || !open) return null;
  const shown = onlyUnread ? data.items.filter((n) => !n.read) : data.items;

  // body වෙත portal කරයි: fixed ස්ථානගත කිරීම sidebar/transform ancestors මගින් බිඳී නොයාමට
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />
      <section
        role="dialog"
        aria-label={t("දැනුම්දීම්")}
        data-testid="notif-panel"
        className="fixed inset-x-3 top-[4.25rem] z-[61] flex max-h-[min(34rem,calc(100dvh-5.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[0_30px_60px_-20px_rgb(6_13_34/0.45)] sm:left-auto sm:right-4 sm:w-[25rem] lg:right-6 lg:top-[4.5rem]"
      >
        <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <h2 className="flex-1 font-display text-base font-bold text-navy">{t("දැනුම්දීම්")}</h2>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            aria-label={t("පෙරහන")}
            title={t("පෙරහන")}
            data-testid="notif-filter-btn"
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 ${onlyUnread ? "text-primary" : "text-muted"}`}
          >
            <Icon name="filter" className="h-4 w-4" />
            {onlyUnread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
          </button>
          {data.unread > 0 && (
            <button type="button" onClick={markAll} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary-soft">
              {t("සියල්ල කියවූ ලෙස සලකුණු කරන්න")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("වසන්න")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-slate-100"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>

        {filterOpen && (
          <div className="flex gap-2 border-b border-line bg-white px-4 py-2" role="group" aria-label={t("පෙරහන")} data-testid="notif-filter">
            {([false, true] as const).map((u) => (
              <button
                key={String(u)}
                type="button"
                onClick={() => setOnlyUnread(u)}
                aria-pressed={onlyUnread === u}
                data-testid={u ? "notif-filter-unread" : "notif-filter-all"}
                className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold ${onlyUnread === u ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:bg-slate-50"}`}
              >
                {u ? `${t("නොකියවූ")} (${data.unread})` : t("සියල්ල")}
              </button>
            ))}
          </div>
        )}
        {status === "error" && (
          <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-accent-soft px-4 py-2.5 text-xs text-red-900">
            <span className="flex-1">{t("දැනුම්දීම් නවීකරණය කළ නොහැකි විය. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.")}</span>
            <button type="button" onClick={reload} className="min-h-8 rounded-lg px-2.5 font-semibold underline">
              {t("නැවත උත්සාහ කරන්න")}
            </button>
          </div>
        )}
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted">
            <Icon name="bell" className="h-8 w-8 text-slate-300" />
            <p>{t(data.items.length === 0 ? "තවම දැනුම්දීම් නැත." : "නොකියවූ දැනුම්දීම් නැත.")}</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-line overflow-y-auto overscroll-contain" data-testid="notif-list">
            {shown.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                    // දැනටමත් එම පිටුවේම නම් Link එක කිසිවක් නොපෙන්වයි: පිටුව නවීකරණය කර ඉහළට යයි
                    if (n.href.split("#")[0] === pathname) {
                      router.refresh();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  data-read={n.read ? "1" : "0"}
                  className={`flex gap-3 px-4 py-3 transition hover:bg-primary-soft/60 ${n.read ? "" : "bg-primary-soft/40"}`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.read ? "bg-slate-100 text-muted" : "bg-primary text-white"}`}
                  >
                    <Icon name={n.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-snug ${n.read ? "font-medium" : "font-bold"} text-navy`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block break-words text-[13px] leading-snug text-muted">{n.body}</span>}
                    <span className="mt-1 block text-xs text-slate-400">{now ? ago(n.at, now, lang) : ""}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label={t("නොකියවූ")} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data.items.length > 0 && (
          <footer className="border-t border-line bg-surface px-4 py-1.5 text-center">
            <button type="button" onClick={clearAll} data-testid="notif-clear-all" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50">
              {t("සියල්ල ඉවත් කරන්න")}
            </button>
          </footer>
        )}
      </section>
    </>,
    document.body,
  );
}

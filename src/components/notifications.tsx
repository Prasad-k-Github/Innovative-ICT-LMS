"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { DATE_LOCALE } from "@/lib/i18n/core";
import type { NotificationsPayload } from "@/lib/notifications-data";
import { useLang, useT } from "./i18n-provider";
import { Icon } from "./icons";

const POLL_MS = 60_000;

type Ctx = {
  data: NotificationsPayload;
  open: boolean;
  setOpen: (v: boolean) => void;
  now: number;
  markRead: (id: string) => void;
  markAll: () => void;
};
const NotifCtx = createContext<Ctx | null>(null);

// ශ්‍රේණිය/භාෂාව වෙනස් වන විට (key) අලුතින් පටන් ගනී. විනාඩියකට වරක් සහ tab එකට ආපසු ආ විට අලුත් දැනුම්දීම් ලබා ගනී
export function NotificationsProvider({ initial, children }: { initial: NotificationsPayload; children: ReactNode }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as NotificationsPayload);
      setNow(Date.now());
    } catch {
      /* network දෝෂ නොසලකයි; ඊළඟ වාරයේ නැවත උත්සාහ කරයි */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // panel එක විවෘත කරන විට ඉක්මනින් නවීකරණය කරයි
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => void load(), 0);
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

  const markAll = useCallback(() => {
    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, read: true })) }));
    void markAllNotificationsReadAction();
  }, []);

  const value = useMemo(() => ({ data, open, setOpen, now, markRead, markAll }), [data, open, now, markRead, markAll]);
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
  const { data, open, setOpen, now, markRead, markAll } = useNotif();
  const t = useT();
  const lang = useLang();
  const [mounted, setMounted] = useState(false);

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

        {data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted">
            <Icon name="bell" className="h-8 w-8 text-slate-300" />
            <p>{t("තවම දැනුම්දීම් නැත.")}</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-line overflow-y-auto overscroll-contain" data-testid="notif-list">
            {data.items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
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
      </section>
    </>,
    document.body,
  );
}

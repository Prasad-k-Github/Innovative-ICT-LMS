"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { SESSION_WARN_ABS_SECONDS, SESSION_WARN_SECONDS } from "@/lib/constants";
import { loginUrl, parseReason, type EndReason } from "@/lib/session-reason";
import { useT } from "./i18n-provider";

type Warn = { mode: "idle" | "abs"; left: number } | null;
const KEEP_EVERY_MS = 90_000; // පරිශීලක ක්‍රියාකාරිත්වය server එකට දැනුම් දෙන අවම පරතරය

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

// Session ආරක්ෂාව (client): ඉතිරි කාලය අනුගමනය කරයි; ක්‍රියාකාරිත්වය දැනුම් දී idle කාලය දිගු කරයි;
// ඉකුත් වීමට ආසන්නව අනතුරු ඇඟවීමක් පෙන්වයි; අවසන් වූ විට (හෝ වෙනත් තැනකින් අවසන් කළ විට) login පිටුවට හේතුව සමඟ යවයි.
export function SessionGuard() {
  const t = useT();
  const pathname = usePathname();
  const [warn, setWarn] = useState<Warn>(null);
  const [dismissedAbs, setDismissedAbs] = useState(false);
  const dl = useRef<{ idleAt: number; absAt: number } | null>(null);
  const ended = useRef(false);
  const lastKeep = useRef(0);
  const verifying = useRef(false);
  const warnOpen = useRef(false);
  const path = useRef(pathname);
  const stayRef = useRef<HTMLButtonElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    path.current = pathname;
  }, [pathname]);
  useEffect(() => {
    dismissedRef.current = dismissedAbs;
  }, [dismissedAbs]);

  const end = useCallback((reason: EndReason) => {
    if (ended.current) return;
    ended.current = true;
    window.location.assign(loginUrl(reason, path.current));
  }, []);

  const sync = useCallback(
    async (keep = false) => {
      try {
        const r = await fetch(keep ? "/api/session/keepalive" : "/api/session", { method: keep ? "POST" : "GET", headers: keep ? { "x-ict-keepalive": "1" } : undefined, cache: "no-store" });
        if (r.status === 401) {
          const j = (await r.json().catch(() => ({}))) as { reason?: string };
          end(parseReason(j.reason) ?? "expired");
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as { idleLeftMs: number; absLeftMs: number };
        const now = Date.now();
        dl.current = { idleAt: now + d.idleLeftMs, absAt: now + d.absLeftMs };
        if (keep) lastKeep.current = now;
      } catch {
        /* ජාලය නැති විට: ඊළඟ වාරයේදී නැවත උත්සාහ කරයි (දේශීය ඔරලෝසුව දිගටම ක්‍රියා කරයි) */
      }
    },
    [end],
  );

  // ආරම්භය, පසුබිම් පරීක්ෂා, tab එකට ආපසු ආවිට / ජාලය නැවත ලැබුණු විට
  useEffect(() => {
    lastKeep.current = Date.now();
    const first = setTimeout(() => void sync(), 0);
    const onVis = () => document.visibilityState === "visible" && void sync();
    const onOnline = () => void sync();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVis);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVis);
    };
  }, [sync]);

  // පරිශීලක ක්‍රියාකාරිත්වය (click / key / scroll / touch) -> idle කාලය නැවත ආරම්භ (විනාඩි 1½කට වරක්)
  useEffect(() => {
    const act = () => {
      if (warnOpen.current || ended.current) return; // අනතුරු ඇඟවීම පෙන්වන විට "දිගටම සිටින්න" බොත්තමෙන් පමණි
      if (Date.now() - lastKeep.current > KEEP_EVERY_MS) {
        lastKeep.current = Date.now();
        void sync(true);
      }
    };
    const evs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of evs) window.addEventListener(e, act, { passive: true });
    return () => {
      for (const e of evs) window.removeEventListener(e, act);
    };
  }, [sync]);

  // තත්පරයෙන් තත්පරය: ඉතිරි කාලය ගණනය, අනතුරු ඇඟවීම, අවසන් වූ විට server සමඟ තහවුරු කර login වෙත යැවීම
  useEffect(() => {
    const id = setInterval(() => {
      const d = dl.current;
      if (!d || ended.current) return;
      const now = Date.now();
      const idleLeft = (d.idleAt - now) / 1000;
      const absLeft = (d.absAt - now) / 1000;
      if (idleLeft <= 0 || absLeft <= 0) {
        if (verifying.current) return;
        verifying.current = true;
        void sync().finally(() => {
          verifying.current = false;
          const n = dl.current;
          if (n && (n.idleAt <= Date.now() || n.absAt <= Date.now())) end(n.absAt <= Date.now() ? "expired" : "idle");
        });
        return;
      }
      let next: Warn = null;
      if (absLeft <= SESSION_WARN_ABS_SECONDS && absLeft <= idleLeft) next = { mode: "abs", left: absLeft };
      else if (idleLeft <= SESSION_WARN_SECONDS) next = { mode: "idle", left: idleLeft };
      warnOpen.current = !!next && !(next.mode === "abs" && dismissedRef.current);
      setWarn((p) => (next === null ? (p === null ? p : null) : p && p.mode === next.mode && Math.floor(p.left) === Math.floor(next.left) ? p : next));
    }, 1000);
    return () => clearInterval(id);
  }, [sync, end]);

  // අනතුරු ඇඟවීම පෙන්වන විට: server එක සමඟ වඩා ඉක්මනින් (තත්පර 15කට වරක්) සමමුහුර්ත කරයි (වෙනත් tab එකකින් ක්‍රියාකාරී වූයේ නම් අනතුරු ඇඟවීම ඉවත් වේ)
  const open = warn !== null;
  useEffect(() => {
    const id = setInterval(() => void sync(), open ? 15_000 : 60_000);
    return () => clearInterval(id);
  }, [open, sync]);

  const showModal = warn !== null && !(warn.mode === "abs" && dismissedAbs);
  useEffect(() => {
    if (showModal) stayRef.current?.focus();
  }, [showModal, warn?.mode]);

  if (!showModal || !warn) return null;
  const idle = warn.mode === "idle";
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm" data-testid="session-warning" data-mode={warn.mode}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="sess-title" aria-describedby="sess-desc" className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-4xl" aria-hidden="true">⏳</p>
        <h2 id="sess-title" className="mt-2 font-display text-xl font-bold text-navy">
          {t("ඔබේ session එක ඉක්මනින් අවසන් වේ")}
        </h2>
        <p id="sess-desc" className="mt-2 text-sm leading-relaxed text-muted">
          {idle ? t("ටික වේලාවක් ක්‍රියාකාරී නොවූ නිසා ආරක්ෂාව සඳහා ඔබව ස්වයංක්‍රීයව logout කරනු ඇත.") : t("ආරක්ෂාව සඳහා session එකක උපරිම කාලයක් ඇත. ඔබේ වැඩ සුරකින්න; නැවත login විය යුතුයි.")}
        </p>
        <p className="mt-3 font-display text-4xl font-bold tabular-nums text-accent" data-testid="session-countdown">
          {fmt(warn.left)}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {idle ? (
            <button
              ref={stayRef}
              type="button"
              data-testid="session-stay"
              onClick={() => {
                void sync(true);
                warnOpen.current = false;
                setWarn(null);
              }}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark"
            >
              {t("දිගටම සිටින්න")}
            </button>
          ) : (
            <button
              ref={stayRef}
              type="button"
              data-testid="session-dismiss"
              onClick={() => {
                setDismissedAbs(true);
                warnOpen.current = false;
              }}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark"
            >
              {t("තේරුණා")}
            </button>
          )}
          <form action={logoutAction}>
            <button type="submit" data-testid="session-logout" className="min-h-11 w-full rounded-xl border border-line bg-white px-5 text-sm font-semibold text-navy transition hover:bg-slate-50">
              {t("Logout වන්න")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

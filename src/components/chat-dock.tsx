"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChatRoom, type ChatMsg } from "./chat-room";
import { useT } from "./i18n-provider";
import { Icon } from "./icons";

export type DockConfig = { rooms: string[]; labels: Record<string, string>; defaultRoom: string; isAdmin: boolean; base: string; max: number };

// පැත්තේ chat dock: විවෘත/වසා තිබීම (තේරීම browser එකේ මතක තබා ගනී; තේරීමක් නැත්නම් විශාල තිරයේ විවෘතව)
const DOCK_KEY = "ict_chat_dock";
const ROOM_KEY = "ict_chat_room";
const XL = "(min-width: 1280px)";
let pref: "1" | "0" | null | undefined;
const listeners = new Set<() => void>();
const readPref = () => {
  if (pref === undefined) {
    try {
      const v = localStorage.getItem(DOCK_KEY);
      pref = v === "1" || v === "0" ? v : null;
    } catch {
      pref = null;
    }
  }
  return pref;
};
const snapshot = () => (readPref() === "1" || (readPref() === null && window.matchMedia(XL).matches) ? "open" : "closed");
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const mq = window.matchMedia(XL);
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
};
function setDock(open: boolean) {
  pref = open ? "1" : "0";
  try {
    localStorage.setItem(DOCK_KEY, pref);
  } catch {
    /* ගබඩාව නොමැති විට මතකයේ පමණක් */
  }
  listeners.forEach((f) => f());
}
export function useDockOpen() {
  return useSyncExternalStore(subscribe, snapshot, () => "closed") === "open";
}

const seenKey = (room: string) => `ict_chat_seen_${room}`;
function getSeen(room: string) {
  try {
    return localStorage.getItem(seenKey(room)) ?? "";
  } catch {
    return "";
  }
}
function setSeen(room: string, at: string) {
  try {
    localStorage.setItem(seenKey(room), at);
  } catch {
    /* අවශ්‍ය නැත */
  }
}

export function ChatDock({ config }: { config: DockConfig }) {
  const t = useT();
  const open = useDockOpen();
  const [room, setRoom] = useState(config.defaultRoom);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  const roomRef = useRef(room);

  useEffect(() => {
    openRef.current = open;
    roomRef.current = room;
  }, [open, room]);

  // මතක තබාගත් කාමරය (වලංගු නම්)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const saved = localStorage.getItem(ROOM_KEY);
        if (saved && config.rooms.includes(saved)) setRoom(saved);
      } catch {
        /* අවශ්‍ය නැත */
      }
    }, 0);
    return () => clearTimeout(id);
  }, [config.rooms]);

  // dock එක විවෘතව ඇති විට ලැබෙන පණිවිඩ "කියවූ" ලෙස සලකයි
  const onUpdate = useCallback((msgs: ChatMsg[]) => {
    if (!openRef.current) return;
    const last = msgs.at(-1)?.at;
    if (last) setSeen(roomRef.current, last);
    setUnread(0);
  }, []);

  // වසා ඇති විට: තත්පර 30කට වරක් නොකියවූ පණිවිඩ ගණන බලයි (badge)
  useEffect(() => {
    if (open) return;
    let stop = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/chat?room=${encodeURIComponent(room)}`, { cache: "no-store" });
        if (!r.ok || stop) return;
        const d = (await r.json()) as { messages: ChatMsg[] };
        const seen = getSeen(room);
        if (!seen) {
          // පළමු වතාවට: දැනට ඇති පණිවිඩ නොකියවූ ලෙස නොගණයි
          const last = d.messages.at(-1)?.at;
          if (last) setSeen(room, last);
          setUnread(0);
          return;
        }
        setUnread(d.messages.filter((m) => !m.mine && !m.hidden && m.at > seen).length);
      } catch {
        /* ජාලය අහිමි නම් මීළඟ වාරයේදී */
      }
    };
    const first = setTimeout(check, 1500);
    const id = setInterval(check, 30_000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open, room]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setDock(true)}
        aria-label={t("Chat විවෘත කරන්න")}
        data-testid="chat-dock-open"
        className="fixed bottom-4 right-4 z-[60] flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-[0_14px_28px_-12px_rgb(10_92_194/0.9)] transition hover:bg-primary-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <Icon name="chat" className="h-5 w-5" />
        <span className="hidden sm:inline">{t("Chat")}</span>
        {unread > 0 && (
          <span data-testid="chat-dock-unread" className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      data-testid="chat-dock"
      aria-label={t("Live chat")}
      className="fixed inset-y-0 right-0 z-[65] flex w-full flex-col border-l border-line bg-white shadow-2xl sm:w-96 xl:z-40 xl:w-80 xl:shadow-none"
    >
      <header className="flex items-center gap-2 border-b border-line bg-gradient-to-r from-violet-50 via-white to-primary-soft px-3 py-2.5">
        <Icon name="chat" className="h-5 w-5 shrink-0 text-primary" />
        <select
          value={room}
          onChange={(e) => {
            setRoom(e.target.value);
            setUnread(0);
            try {
              localStorage.setItem(ROOM_KEY, e.target.value);
            } catch {
              /* අවශ්‍ය නැත */
            }
          }}
          aria-label={t("කාමරය")}
          data-testid="chat-dock-room"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-sm font-semibold text-navy"
        >
          {config.rooms.map((r) => (
            <option key={r} value={r}>
              {config.labels[r] ?? r}
            </option>
          ))}
        </select>
        <Link href={`${config.base}/chat?room=${room}`} title={t("සම්පූර්ණ පිටුවේ විවෘත කරන්න")} aria-label={t("සම්පූර්ණ පිටුවේ විවෘත කරන්න")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-navy hover:bg-primary-soft">
          <span aria-hidden="true">↗</span>
        </Link>
        <button type="button" onClick={() => setDock(false)} aria-label={t("Chat වසන්න")} data-testid="chat-dock-close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-lg text-navy hover:bg-primary-soft">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <ChatRoom key={room} room={room} initial={[]} isAdmin={config.isAdmin} back={`${config.base}/chat?room=${room}`} max={config.max} compact onUpdate={onUpdate} />
      </div>
    </aside>
  );
}

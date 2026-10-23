"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportAction, sendChatMessageAction, setChatHiddenAction } from "@/app/actions/community";
import { Avatar } from "./cards";
import { useT } from "./i18n-provider";

export type ChatMsg = { id: string; body: string; hidden: boolean; at: string; name: string; sub: string; staff: boolean; mine: boolean };

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" });
const POLL_MS = 4000;

// Live chat කාමරය: තත්පර 4කට වරක් නව පණිවිඩ ලබා ගනී (පිටුව පිටුපස ඇති විට නවතී)
export function ChatRoom({
  room,
  initial,
  isAdmin,
  back,
  max,
  compact = false,
  onUpdate,
}: {
  room: string;
  initial: ChatMsg[];
  isAdmin: boolean;
  back: string;
  max: number;
  compact?: boolean; // පැත්තේ dock එක සඳහා: උස පිරවීම, පණිවිඩ වල report/සඟවීම් බොත්තම් නැත
  onUpdate?: (msgs: ChatMsg[]) => void;
}) {
  const t = useT();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = useRef<string>(initial.at(-1)?.id ?? "");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?room=${encodeURIComponent(room)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { messages: ChatMsg[] };
      setMsgs(d.messages);
      onUpdate?.(d.messages);
    } catch {
      /* ජාලය අහිමි වූ විට මීළඟ වාරයේදී නැවත උත්සාහ කරයි */
    }
  }, [room, onUpdate]);

  // dock එකේදී (initial නැති විට) විවෘත වූ වහාම පණිවිඩ ලබා ගනී
  useEffect(() => {
    if (initial.length !== 0) return;
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const vis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [load]);

  // අලුත් පණිවිඩයක් ආවිට (පරිශීලකයා පහළ ඇති විට) පහළට scroll කරයි
  useEffect(() => {
    const el = box.current;
    const last = msgs.at(-1)?.id ?? "";
    if (el && last !== lastId.current && stick.current) el.scrollTop = el.scrollHeight;
    lastId.current = last;
  }, [msgs]);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendChatMessageAction(room, body);
      if (res.ok) {
        setText("");
        stick.current = true;
        await load();
      } else setError(res.error ?? t("යැවීමට නොහැකි විය."));
    } catch {
      setError(t("ජාල දෝෂයක්. නැවත උත්සාහ කරන්න."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col overflow-hidden" : "card flex flex-col overflow-hidden p-0"} data-testid="chat-room">
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className={`space-y-3 overflow-y-auto bg-surface p-3 sm:p-4 ${compact ? "min-h-0 flex-1" : "h-[55vh] min-h-[20rem]"}`}
        aria-live="polite"
        data-testid="chat-messages"
      >
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">{t("තවම පණිවිඩ නැත. පළමුව ආරම්භ කරන්න! 👋")}</p>}
        {msgs.map((m) => (
          <div key={m.id} data-chat-msg data-mine={m.mine ? "1" : "0"} data-hidden={m.hidden ? "1" : "0"} className={`flex items-end gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
            <Avatar name={m.name} size="sm" />
            <div className={`group max-w-[82%] ${m.mine ? "items-end text-right" : ""}`}>
              <p className="mb-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <strong className="text-ink">{m.name}</strong>
                {m.staff && <span className="rounded-full bg-sun px-2 py-0.5 font-bold text-navy">{t("ගුරුතුමා")}</span>}
                {m.sub && <span>{m.sub}</span>}
                <span>{timeFmt.format(new Date(m.at))}</span>
              </p>
              <p
                className={`inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                  m.hidden ? "border border-dashed border-line bg-white text-muted line-through" : m.mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-white text-ink shadow-sm"
                }`}
              >
                {m.body}
              </p>
              <div className="mt-0.5 flex gap-3 text-xs">
                {!compact && !m.mine && !isAdmin && (
                  <form action={reportAction}>
                    <input type="hidden" name="kind" value="CHAT" />
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="back" value={back} />
                    <button type="submit" data-testid="chat-report" className="min-h-8 text-muted underline hover:text-accent" onClick={(e) => !window.confirm(t("මෙම පණිවිඩය ගුරුතුමාට වාර්තා කරන්නද?")) && e.preventDefault()}>
                      {t("වාර්තා කරන්න")}
                    </button>
                  </form>
                )}
                {!compact && isAdmin && (
                  <form action={setChatHiddenAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="value" value={m.hidden ? "0" : "1"} />
                    <input type="hidden" name="back" value={back} />
                    <button type="submit" data-testid="chat-hide" className="min-h-8 text-muted underline hover:text-accent">
                      {m.hidden ? t("නැවත පෙන්වන්න") : t("සඟවන්න")}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="border-t border-line bg-white p-3" data-testid="chat-form">
        {error && (
          <p role="alert" data-testid="chat-error" className="mb-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={max}
            aria-label={t("පණිවිඩය")}
            placeholder={t("පණිවිඩයක් ලියන්න...")}
            data-testid="chat-input"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <button type="submit" disabled={sending || !text.trim()} data-testid="chat-send" className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
            {t("යවන්න")}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">{t("ආරක්ෂාව සඳහා link, email, දුරකථන අංක යැවිය නොහැක. ගරුසරු ලෙස සංවාද කරන්න.")}</p>
      </form>
    </div>
  );
}

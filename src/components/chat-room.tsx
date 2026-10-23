"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { reportAction, sendChatMessageAction, setChatHiddenAction } from "@/app/actions/community";
import { Avatar } from "./cards";
import { ConfirmButton } from "./confirm-button";
import { useT } from "./i18n-provider";
import { Icon } from "./icons";

export type ChatMsg = { id: string; body: string; hidden: boolean; at: string; name: string; sub: string; staff: boolean; avatar: string | null; mine: boolean };

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" });
const POLL_MS = 4000;
const EMOJIS = ["😊", "😂", "👍", "🙏", "🎉", "❤️", "🤔", "😅", "💪", "👏", "📚", "💻", "✅", "🔥", "😍", "🙌", "😎", "🤝"];

// Live chat කාමරය: තත්පර 4කට වරක් නව පණිවිඩ ලබා ගනී (පිටුව පිටුපස ඇති විට නවතී)
export function ChatRoom({
  room,
  initial,
  isAdmin,
  back,
  max,
  compact = false,
  onUpdate,
  title,
  actions,
}: {
  room: string;
  initial: ChatMsg[];
  isAdmin: boolean;
  back: string;
  max: number;
  compact?: boolean; // පැත්තේ dock එක සඳහා: උස පිරවීම, පණිවිඩ වල report/සඟවීම් බොත්තම් නැත
  onUpdate?: (msgs: ChatMsg[]) => void;
  title?: ReactNode; // ඉහළ නිල් තීරුවේ මාතෘකාව (කාමරයේ නම හෝ කාමර තේරීම)
  actions?: ReactNode; // ඉහළ තීරුවේ දකුණු පස බොත්තම් (dock එකේ: සම්පූර්ණ පිටුව / වසන්න)
}) {
  const t = useT();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
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

  function addEmoji(em: string) {
    setText((v) => (v + em).slice(0, max));
    setEmojiOpen(false);
    input.current?.focus();
  }

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
    <div className={`flex flex-col overflow-hidden bg-white ${compact ? "h-full min-h-0" : "rounded-3xl border border-line shadow-[0_24px_48px_-28px_rgb(10_37_84/0.45)]"}`} data-testid="chat-room">
      {/* ඉහළ නිල් තීරුව (තරංග හැඩයෙන් අවසන් වේ) */}
      <header className="relative shrink-0 bg-gradient-to-br from-primary-dark via-primary to-primary-bright text-white" data-testid="chat-header">
        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40" aria-hidden="true">
            <Icon name="chat" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 font-display text-lg font-bold leading-tight">{title ?? t("Live chat")}</div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
        <p className="flex items-center gap-1.5 px-4 pb-5 pl-[4.5rem] text-sm text-white/90">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgb(110_231_183/0.3)]" aria-hidden="true" />
          {t("සජීවීව සංවාද කරන්න")}
        </p>
        <svg viewBox="0 0 500 24" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px block h-4 w-full text-white" aria-hidden="true">
          <path d="M0 24V11C110 -1 215 3 320 9C395 13 455 6 500 0V24Z" fill="currentColor" />
        </svg>
      </header>

      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className={`space-y-3 overflow-y-auto bg-white px-3 pb-3 pt-2 sm:px-4 ${compact ? "min-h-0 flex-1" : "h-[55vh] min-h-[20rem]"}`}
        aria-live="polite"
        data-testid="chat-messages"
      >
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">{t("තවම පණිවිඩ නැත. පළමුව ආරම්භ කරන්න! 👋")}</p>}
        {msgs.map((m) => (
          <div key={m.id} data-chat-msg data-mine={m.mine ? "1" : "0"} data-hidden={m.hidden ? "1" : "0"} className={`flex items-end gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
            {(!m.mine || m.avatar) && <Avatar name={m.name} size="sm" src={m.avatar} />}
            <div className={`group flex max-w-[82%] flex-col ${m.mine ? "items-end" : "items-start"}`}>
              {!m.mine && (
                <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-xs text-muted">
                  <strong className="text-ink">{m.name}</strong>
                  {m.staff && <span className="rounded-full bg-sun px-2 py-0.5 font-bold text-navy">{t("ගුරුතුමා")}</span>}
                  {m.sub && <span>{m.sub}</span>}
                </p>
              )}
              <p
                className={`inline-block whitespace-pre-wrap rounded-[1.4rem] px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                  m.hidden
                    ? "border border-dashed border-line bg-white text-muted line-through"
                    : m.mine
                      ? "rounded-br-lg bg-gradient-to-br from-primary to-primary-bright text-white shadow-[0_8px_16px_-10px_rgb(10_92_194/0.9)]"
                      : "rounded-bl-lg bg-[#eff2f8] text-ink"
                }`}
              >
                {m.body}
              </p>
              <div className={`mt-1 flex items-center gap-3 px-1 text-xs text-muted ${m.mine ? "flex-row-reverse" : ""}`}>
                <time dateTime={m.at}>{timeFmt.format(new Date(m.at))}</time>
                {!compact && !m.mine && !isAdmin && (
                  <form action={reportAction}>
                    <input type="hidden" name="kind" value="CHAT" />
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="back" value={back} />
                    <ConfirmButton testId="chat-report" tone="warning" title={t("පණිවිඩය වාර්තා කරන්නද?")} confirmLabel={t("ඔව්, වාර්තා කරන්න")} message={t("මෙම පණිවිඩය ගුරුතුමාට වාර්තා කරන්නද?")} className="min-h-8 underline hover:text-accent">
                      {t("වාර්තා කරන්න")}
                    </ConfirmButton>
                  </form>
                )}
                {!compact && isAdmin && (
                  <form action={setChatHiddenAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="value" value={m.hidden ? "0" : "1"} />
                    <input type="hidden" name="back" value={back} />
                    <button type="submit" data-testid="chat-hide" className="min-h-8 underline hover:text-accent">
                      {m.hidden ? t("නැවත පෙන්වන්න") : t("සඟවන්න")}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="relative shrink-0 border-t border-line bg-white px-4 pb-3 pt-3" data-testid="chat-form">
        {error && (
          <p role="alert" data-testid="chat-error" className="mb-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        )}
        <textarea
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          maxLength={max}
          aria-label={t("පණිවිඩය")}
          placeholder={t("පණිවිඩයක් ලියන්න...")}
          data-testid="chat-input"
          className="block max-h-32 min-h-[3.25rem] w-full resize-none bg-transparent pr-16 text-base leading-relaxed text-ink outline-none placeholder:text-muted/80"
        />
        <div className="mt-1 flex items-center gap-2 pr-16">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            aria-label={t("Emoji")}
            aria-expanded={emojiOpen}
            data-testid="chat-emoji-btn"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl transition hover:bg-primary-soft"
          >
            <span aria-hidden="true">😊</span>
          </button>
          <p className="min-w-0 text-[11px] leading-snug text-muted">{t("ආරක්ෂාව සඳහා link, email, දුරකථන අංක යැවිය නොහැක. ගරුසරු ලෙස සංවාද කරන්න.")}</p>
        </div>
        {emojiOpen && (
          <div className="absolute bottom-full left-3 z-10 mb-1 grid w-60 grid-cols-6 gap-1 rounded-2xl border border-line bg-white p-2 shadow-xl" data-testid="chat-emoji-grid" role="group" aria-label={t("Emoji")}>
            {EMOJIS.map((em) => (
              <button key={em} type="button" onClick={() => addEmoji(em)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-primary-soft">
                {em}
              </button>
            ))}
          </div>
        )}
        <button
          type="submit"
          disabled={sending || !text.trim()}
          data-testid="chat-send"
          aria-label={t("යවන්න")}
          className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-dark to-primary-bright text-white shadow-[0_12px_22px_-8px_rgb(10_92_194/0.9)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          <Icon name="arrow" className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

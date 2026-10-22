"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { newAgentChatAction, sendAgentMessageAction } from "@/app/actions/agent";
import { AGENT_MAX_CHARS, AGENT_NAME } from "@/lib/agent-config";
import { Tile } from "./cards";
import { useT } from "./i18n-provider";
import { Icon } from "./icons";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type Locked = null | "quiz" | "credits" | "unavailable";

/* ---- AI පිළිතුර ආරක්ෂිතව පෙන්වීමට සරල markdown (HTML කිසිවිටක් එලෙසම ඇතුළත් නොකරයි) ---- */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      tok.startsWith("**") ? (
        <strong key={i++} className="font-bold text-navy">
          {tok.slice(2, -2)}
        </strong>
      ) : (
        <code key={i++} className="rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[0.85em] text-primary-dark">
          {tok.slice(1, -1)}
        </code>
      ),
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push(
          <pre key={`c${blocks.length}`} className="overflow-x-auto rounded-xl bg-navy-950 p-3 font-mono text-xs leading-relaxed text-white">
            {code.join("\n")}
          </pre>,
        );
        code = null;
      } else {
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      list.push(li[1]);
      continue;
    }
    flushList();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
  }
  if (code) blocks.push(<pre key="c-end" className="overflow-x-auto rounded-xl bg-navy-950 p-3 font-mono text-xs text-white">{code.join("\n")}</pre>);
  flushList();
  return <div className="space-y-2 break-words">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}

function Mascot({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return <Tile icon="sparkle" tone="violet" size={size} />;
}

export function AgentChat({
  initial,
  balance: initialBalance,
  locked: initialLocked,
  starters,
  firstName,
}: {
  initial: Msg[];
  balance: number;
  locked: Locked;
  starters: string[];
  firstName: string;
}) {
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [balance, setBalance] = useState(initialBalance);
  const [locked, setLocked] = useState<Locked>(initialLocked);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const send = (raw: string) => {
    const msg = raw.trim();
    if (!msg || pending || locked) return;
    setError(null);
    setText("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: msg }]);
    start(async () => {
      const res = await sendAgentMessageAction(msg);
      if (res.ok && res.reply) {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: res.reply! }]);
        if (typeof res.balance === "number") {
          setBalance(res.balance);
          if (res.balance <= 0) setLocked("credits");
        }
      } else {
        // අසාර්ථක: ඔබේ පණිවිඩය නැවත ලියන ප්‍රදේශයට දමයි
        setMessages((m) => m.slice(0, -1));
        setText(msg);
        if (typeof res.balance === "number") setBalance(res.balance);
        if (res.locked) setLocked(res.locked);
        else setError(res.error ?? t("යම් දෝෂයක් සිදු විය."));
      }
      inputRef.current?.focus();
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    }
  };

  const newChat = () => {
    if (pending) return;
    start(async () => {
      await newAgentChatAction();
      setMessages([]);
      setError(null);
    });
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const low = balance > 0 && balance <= 5;

  return (
    <section className="card overflow-hidden" data-testid="agent-chat">
      {/* ඉහළ තීරුව */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-gradient-to-r from-violet-50 via-white to-primary-soft px-4 py-3">
        <div className="flex min-w-[11rem] flex-1 items-center gap-3">
          <Mascot />
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-navy">{t(AGENT_NAME)}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              {locked === "quiz" ? t("විවේක ගනිමින්") : t("ඔබට උදව් කරන්න සූදානම්")}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <span
            data-testid="agent-credits"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${low || balance === 0 ? "bg-accent-soft text-accent" : "bg-sun-soft text-amber-800"}`}
            title={t("ඉතිරි credits")}
          >
            <Icon name="sparkle" className="h-4 w-4" />
            <span data-testid="agent-credits-n">{balance}</span>
            <span className="text-xs font-semibold">{t("credits")}</span>
          </span>
          <button
            type="button"
            onClick={newChat}
            disabled={pending || messages.length === 0}
            data-testid="agent-new-chat"
            className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-40"
          >
            {t("අලුත් සංවාදයක්")}
          </button>
        </div>
      </header>

      {/* පණිවිඩ */}
      <div ref={listRef} className="h-[48vh] min-h-[300px] sm:h-[56vh] space-y-4 overflow-y-auto bg-surface/60 px-3 py-4 sm:px-5" aria-live="polite" data-testid="agent-messages">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md pt-4 text-center">
            <div className="mx-auto w-fit">
              <Mascot size="lg" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-navy">{t("හායි {name}! 👋", { name: firstName })}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("මම ඔබේ ICT මිතුරා. ICT ගැන ඕනෑම දෙයක් අහන්න. මම උදව් කරන්නම්, නමුත් ඔබත් එකට හිතලා ඉගෙන ගමු! 😊")}</p>
            <div className="mt-5 flex flex-col gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={!!locked}
                  data-testid="agent-starter"
                  className="min-h-11 rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end" data-testid="msg-user">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-primary-bright px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_8px_16px_-10px_rgb(10_92_194/0.9)]">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2.5" data-testid="msg-assistant">
              <Mascot size="sm" />
              <div className="min-w-0 max-w-[88%] space-y-2">
                <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-sm">
                  <RichText text={m.content} />
                </div>
                {m.id === lastAssistant && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900" data-testid="agent-selfstudy">
                    <span aria-hidden="true">💪</span>
                    <span className="font-semibold">{t("දැන් ඔබම උත්සාහ කරලා බලන්න!")}</span>
                    <Link href="/dashboard" className="font-bold text-emerald-800 underline underline-offset-2">
                      {t("පාඩම් කියවන්න")}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex items-start gap-2.5" data-testid="agent-typing">
            <Mascot size="sm" />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3.5 shadow-sm" role="status" aria-label={t("ICT මිතුරා හිතමින් සිටී...")}>
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400 motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ලිවීමේ කොටස / අගුළු තත්ත්වය */}
      <div className="border-t border-line bg-white p-3 sm:p-4">
        {locked === "quiz" && (
          <div className="rounded-2xl border border-sun/60 bg-sun-soft p-4 text-center" data-testid="agent-locked" data-lock="quiz">
            <p className="text-2xl" aria-hidden="true">📝</p>
            <p className="mt-1 font-display text-base font-bold text-navy">{t("දැන් Quiz එකක් කරමින් සිටිනවා නේද?")}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-amber-950">{t("Quiz වලදී ICT මිතුරා උදව් කරන්නේ නැහැ — ඔබ දන්න දේ ඔබම පෙන්වන්න! Quiz එක ඉවර වුණාම මම නැවත උදව් කරන්නම්. 💪")}</p>
            <Link href="/dashboard/quizzes" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
              {t("Quiz එකට යන්න")}
            </Link>
          </div>
        )}
        {locked === "credits" && (
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-center" data-testid="agent-locked" data-lock="credits">
            <p className="text-2xl" aria-hidden="true">🌟</p>
            <p className="mt-1 font-display text-base font-bold text-navy">{t("ඔබේ credits අවසානයි")}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-red-900">{t("අලුත් credits ලබාගන්න ගුරුතුමාගෙන් ඉල්ලන්න. ඒ වෙනකම් පාඩම් කියවමින් ඔබම ඉගෙන ගන්න!")}</p>
            <Link href="/dashboard" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
              {t("පාඩම් බලන්න")}
            </Link>
          </div>
        )}
        {locked === "unavailable" && (
          <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-muted" data-testid="agent-locked" data-lock="unavailable">
            {t("ICT මිතුරා තවම සක්‍රිය කර නැත. ටික දවසකින් නැවත එන්න!")}
          </div>
        )}
        {!locked && (
          <>
            {error && (
              <p role="alert" className="mb-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-red-900" data-testid="agent-error">
                {error}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
              className="flex items-end gap-2"
            >
              <label htmlFor="agent-input" className="sr-only">
                {t("ICT මිතුරාගෙන් අහන්න")}
              </label>
              <textarea
                id="agent-input"
                ref={inputRef}
                data-testid="agent-input"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, AGENT_MAX_CHARS))}
                onKeyDown={onKey}
                rows={2}
                maxLength={AGENT_MAX_CHARS}
                placeholder={t("ICT ගැන ඔබේ ප්‍රශ්නය මෙහි ලියන්න...")}
                className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              <button
                type="submit"
                disabled={pending || !text.trim()}
                data-testid="agent-send"
                aria-label={t("යවන්න")}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-bright text-white shadow-[0_10px_18px_-10px_rgb(10_92_194/0.9)] transition hover:brightness-110 disabled:opacity-40"
              >
                <Icon name="arrow" className="h-5 w-5" />
              </button>
            </form>
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
              <span>{t("පණිවිඩයක් = credit 1ක්")}{low && <strong className="ml-2 text-accent">{t("credits අඩුයි!")}</strong>}</span>
              <span>
                {text.length}/{AGENT_MAX_CHARS}
              </span>
            </div>
          </>
        )}
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">{t("ICT මිතුරාට වැරදි විය හැක — පාඩම් සමඟ නැවත පරීක්ෂා කරන්න. ඔබේ සංවාද ගුරුතුමාට බැලිය හැක.")}</p>
      </div>
    </section>
  );
}

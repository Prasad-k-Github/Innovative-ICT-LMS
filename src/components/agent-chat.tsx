"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { newAgentChatAction, sendAgentMessageAction } from "@/app/actions/agent";
import { AGENT_FILE_COST, AGENT_MAX_CHARS, AGENT_MAX_FILES, AGENT_MAX_IMAGE_BYTES, AGENT_MAX_PDF_BYTES, AGENT_MAX_TOTAL_BYTES, AGENT_NAME } from "@/lib/agent-config";
import { Tile } from "./cards";
import { useT } from "./i18n-provider";
import { Icon } from "./icons";

type FileRef = { id: string; name: string; mime: string; url: string };
type Msg = { id: string; role: "user" | "assistant"; content: string; files: FileRef[] };
type Pending = { id: string; file: File; url: string; name: string; mime: string };
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

// ඡායාරූපය browser එකේදීම පොඩි කර JPEG කරයි (වේගවත් යැවීමට; AI වියදම අඩු කිරීමට). වැරදුණොත් null
async function shrinkImage(file: File): Promise<File | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const toBlob = (q: number) => new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
    let blob = await toBlob(0.85);
    if (blob && blob.size > AGENT_MAX_IMAGE_BYTES) blob = await toBlob(0.6);
    if (!blob || blob.size > AGENT_MAX_IMAGE_BYTES) return null;
    return new File([blob], (file.name.replace(/\.[^.]+$/, "") || "image").slice(0, 60) + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

function FileChip({ f, tone = "light" }: { f: { name: string; mime: string; url: string }; tone?: "light" | "dark" }) {
  const isImg = f.mime.startsWith("image/");
  if (isImg) {
    return (
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-black/10" data-testid="msg-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.url} alt={f.name} className="max-h-44 w-auto max-w-full object-cover" />
      </a>
    );
  }
  return (
    <a
      href={f.url}
      download={f.name}
      data-testid="msg-pdf"
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${tone === "dark" ? "bg-white/15 text-white" : "bg-primary-soft text-primary-dark"}`}
    >
      <Icon name="papers" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{f.name}</span>
    </a>
  );
}

export function AgentChat({
  initial,
  balance: initialBalance,
  locked: initialLocked,
  starters,
  firstName,
}: {
  initial: { id: string; role: "user" | "assistant"; content: string; files: { id: string; name: string; mime: string }[] }[];
  balance: number;
  locked: Locked;
  starters: string[];
  firstName: string;
}) {
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>(() => initial.map((m) => ({ ...m, files: m.files.map((f) => ({ ...f, url: `/api/agent-file/${f.id}` })) })));
  const [balance, setBalance] = useState(initialBalance);
  const [locked, setLocked] = useState<Locked>(initialLocked);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const addFiles = async (list: File[]) => {
    if (locked || list.length === 0) return;
    setError(null);
    const room = AGENT_MAX_FILES - files.length;
    if (list.length > room) {
      setError(t("එක් පණිවිඩයකට ගොනු 3ක් දක්වා පමණක් එක් කළ හැක."));
      list = list.slice(0, Math.max(0, room));
    }
    const added: Pending[] = [];
    let total = files.reduce((n, f) => n + f.file.size, 0);
    for (const f of list) {
      let use: File | null = null;
      if (f.type.startsWith("image/")) {
        use = await shrinkImage(f);
        if (!use) {
          setError(t("මෙම ඡායාරූපය භාවිතා කළ නොහැක. JPG හෝ PNG ඡායාරූපයක් තෝරන්න."));
          continue;
        }
      } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        if (f.size > AGENT_MAX_PDF_BYTES) {
          setError(t("PDF ගොනුව 3MB ට වඩා විශාලයි."));
          continue;
        }
        use = f;
      } else {
        setError(t("ඡායාරූප (JPG, PNG, WebP, GIF) සහ PDF ගොනු පමණක් එක් කළ හැක."));
        continue;
      }
      if (total + use.size > AGENT_MAX_TOTAL_BYTES) {
        setError(t("ගොනු වල මුළු ප්‍රමාණය 4MB ට වඩා වැඩියි."));
        continue;
      }
      total += use.size;
      added.push({ id: crypto.randomUUID(), file: use, url: URL.createObjectURL(use), name: use.name, mime: use.type || "application/pdf" });
    }
    if (added.length) setFiles((p) => [...p, ...added]);
  };

  const removeFile = (id: string) =>
    setFiles((p) => {
      const f = p.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return p.filter((x) => x.id !== id);
    });

  const send = (raw: string) => {
    const msg = raw.trim();
    if ((!msg && files.length === 0) || pending || locked) return;
    const sent = files;
    const cost = sent.length ? AGENT_FILE_COST : 1;
    if (balance < cost) {
      setError(t("ගොනු සහිත පණිවිඩයකට credits 2ක් අවශ්‍යයි."));
      return;
    }
    setError(null);
    setText("");
    setFiles([]);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: msg, files: sent.map((f) => ({ id: f.id, name: f.name, mime: f.mime, url: f.url })) }]);
    const fd = new FormData();
    fd.append("text", msg);
    for (const f of sent) fd.append("files", f.file);
    start(async () => {
      const res = await sendAgentMessageAction(fd);
      if (res.ok && res.reply) {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: res.reply!, files: [] }]);
        if (typeof res.balance === "number") {
          setBalance(res.balance);
          if (res.balance <= 0) setLocked("credits");
        }
      } else {
        // අසාර්ථක: ඔබේ පණිවිඩය සහ ගොනු නැවත ලිවීමේ ප්‍රදේශයට දමයි
        setMessages((m) => m.slice(0, -1));
        setText(msg);
        setFiles(sent);
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
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const fl = Array.from(e.clipboardData.files);
    if (fl.length) {
      e.preventDefault();
      void addFiles(fl);
    }
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
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
  const canSend = !pending && (text.trim().length > 0 || files.length > 0);

  return (
    <section
      className="relative flex h-full min-h-0 flex-col bg-surface"
      data-testid="agent-chat"
      onDragOver={(e) => {
        if (!locked && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {/* ඉහළ තීරුව */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-gradient-to-r from-violet-50 via-white to-primary-soft px-4 py-3 sm:px-6">
        <div className="flex min-w-[11rem] flex-1 items-center gap-3">
          <Mascot />
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-navy">{t(AGENT_NAME)}</h1>
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
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" data-testid="agent-messages">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-5 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md pt-4 text-center">
              <div className="mx-auto w-fit">
                <Mascot size="lg" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-navy">{t("හායි {name}! 👋", { name: firstName })}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("මම ඔබේ ICT මිතුරා. ICT ගැන ඕනෑම දෙයක් අහන්න. මම උදව් කරන්නම්, නමුත් ඔබත් එකට හිතලා ඉගෙන ගමු! 😊")}</p>
              <p className="mt-1 text-xs text-muted">{t("පොතේ පිටුවක ඡායාරූපයක් හෝ PDF එකක් ද එවන්න පුළුවන් 📎")}</p>
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
                <div className="flex max-w-[85%] flex-col items-end gap-1.5">
                  {m.files.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {m.files.map((f) => (
                        <FileChip key={f.id} f={f} />
                      ))}
                    </div>
                  )}
                  {m.content && (
                    <p className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-primary-bright px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_8px_16px_-10px_rgb(10_92_194/0.9)]">{m.content}</p>
                  )}
                </div>
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
      </div>

      {/* ලිවීමේ කොටස / අගුළු තත්ත්වය */}
      <div className="border-t border-line bg-white px-3 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
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
              {files.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2" data-testid="agent-pending-files">
                  {files.map((f) => (
                    <li key={f.id} className="relative" data-testid="agent-pending-file">
                      {f.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt={f.name} className="h-16 w-16 rounded-xl object-cover ring-1 ring-line" />
                      ) : (
                        <span className="flex h-16 max-w-[10rem] items-center gap-1.5 rounded-xl bg-primary-soft px-3 text-xs font-semibold text-primary-dark">
                          <Icon name="papers" className="h-4 w-4 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        aria-label={t("ඉවත් කරන්න")}
                        data-testid="agent-remove-file"
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white shadow hover:bg-accent"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(text);
                }}
                className="flex items-end gap-2"
              >
                <input
                  ref={pickRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  data-testid="agent-file-input"
                  onChange={(e) => {
                    void addFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => pickRef.current?.click()}
                  disabled={pending || files.length >= AGENT_MAX_FILES}
                  aria-label={t("ඡායාරූප / PDF එක් කරන්න")}
                  title={t("ඡායාරූප / PDF එක් කරන්න")}
                  data-testid="agent-attach"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-primary transition hover:bg-primary-soft disabled:opacity-40"
                >
                  <Icon name="attach" className="h-5 w-5" />
                </button>
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
                  onPaste={onPaste}
                  rows={2}
                  maxLength={AGENT_MAX_CHARS}
                  placeholder={t("ICT ගැන ඔබේ ප්‍රශ්නය මෙහි ලියන්න...")}
                  className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  data-testid="agent-send"
                  aria-label={t("යවන්න")}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-bright text-white shadow-[0_10px_18px_-10px_rgb(10_92_194/0.9)] transition hover:brightness-110 disabled:opacity-40"
                >
                  <Icon name="arrow" className="h-5 w-5" />
                </button>
              </form>
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
                <span data-testid="agent-cost">
                  {files.length > 0 ? t("ගොනු සහිත පණිවිඩයක් = credits {n}ක්", { n: AGENT_FILE_COST }) : t("පණිවිඩයක් = credit 1ක්")}
                  {low && <strong className="ml-2 text-accent">{t("credits අඩුයි!")}</strong>}
                </span>
                <span>
                  {text.length}/{AGENT_MAX_CHARS}
                </span>
              </div>
            </>
          )}
          <p className="mt-1.5 text-center text-[11px] leading-relaxed text-muted">{t("ICT මිතුරාට වැරදි විය හැක — පාඩම් සමඟ නැවත පරීක්ෂා කරන්න. ඔබේ සංවාද ගුරුතුමාට බැලිය හැක.")}</p>
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-violet-600/15 backdrop-blur-[1px]" data-testid="agent-dropzone">
          <p className="rounded-2xl border-2 border-dashed border-violet-500 bg-white px-6 py-4 font-display text-base font-bold text-violet-700">{t("ඡායාරූප / PDF මෙතැනට දමන්න")}</p>
        </div>
      )}
    </section>
  );
}

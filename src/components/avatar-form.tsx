"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { removeAvatarAction, updateAvatarAction } from "@/app/actions/avatar";
import type { FormState } from "@/lib/validators";
import { Avatar } from "./cards";
import { useT } from "./i18n-provider";
import { Alert, btnPrimary, btnSecondary } from "./ui";

const SIZE = 256; // ප්‍රතිදාන ඡායාරූපය 256x256 (කේන්ද්‍රයෙන් කොටු ලෙස කපා) JPEG
const MAX_INPUT = 12 * 1024 * 1024;

// ඡායාරූපය browser එකේදීම කුඩා කර (≈30KB) සුරකින්න පෙර පෙන්වයි. Server එක නැවත පරීක්ෂා කරයි (ආකෘතිය/ප්‍රමාණය).
async function toSquareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85));
}

export function AvatarForm({ name, currentSrc }: { name: string; currentSrc: string | null }) {
  const t = useT();
  const [state, formAction] = useActionState(
    async (prev: FormState, fd: FormData): Promise<FormState> => ({ ...(await updateAvatarAction(prev, fd)), n: (prev.n ?? 0) + 1 }),
    {} as FormState,
  );
  const [removeState, setRemoveState] = useState<FormState>({});
  const [busy, startTransition] = useTransition();
  const [pick, setPick] = useState<{ blob: Blob; url: string; n: number } | null>(null);
  const [localError, setLocalError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const n = state.n ?? 0;
  // තෝරා ගත් පසු server ප්‍රතිචාරයක් ආවොත් (සාර්ථක) preview එක ඉවත් වේ; දෝෂයක් නම් රඳවා ගනී
  const preview = pick && (pick.n === n || state.error) ? pick : null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setLocalError("");
    setRemoveState({});
    if (!file) return;
    if (!file.type.startsWith("image/")) return setLocalError(t("JPG, PNG හෝ WebP ඡායාරූපයක් පමණක් තෝරන්න."));
    if (file.size > MAX_INPUT) return setLocalError(t("ඡායාරූපය විශාලයි (උපරිම 12MB)."));
    try {
      const blob = await toSquareJpeg(file);
      if (pick) URL.revokeObjectURL(pick.url);
      setPick({ blob, url: URL.createObjectURL(blob), n });
    } catch {
      setLocalError(t("මෙම ඡායාරූපය කියවිය නොහැක. වෙනත් ඡායාරූපයක් තෝරන්න."));
    }
  }

  function save() {
    if (!preview) return;
    const fd = new FormData();
    fd.set("avatar", preview.blob, "avatar.jpg");
    startTransition(() => formAction(fd));
  }

  function remove() {
    startTransition(async () => {
      setRemoveState(await removeAvatarAction());
    });
  }

  const shown = preview?.url ?? currentSrc;
  const message = localError || state.error;
  const ok = !preview && !message ? (removeState.ok ? removeState.message : state.ok ? state.message : "") : "";

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6" data-testid="avatar-form">
      <div className="relative">
        <Avatar name={name} src={shown} size="xl" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={t("ඡායාරූපය තෝරන්න")}
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-2 ring-white transition hover:bg-primary-dark"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="sr-only" data-testid="avatar-input" aria-label={t("ඡායාරූපය තෝරන්න")} />
      </div>
      <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
        <div>
          <p className="font-semibold text-navy">{t("Profile ඡායාරූපය")}</p>
          <p className="text-xs text-muted">{t("JPG, PNG හෝ WebP. කොටු ලෙස කපා කුඩා කරනු ලැබේ.")}</p>
        </div>
        {message && <Alert kind="error">{message}</Alert>}
        {ok && <Alert kind="success">{ok}</Alert>}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {preview ? (
            <>
              <button type="button" onClick={save} disabled={busy} className={`${btnPrimary} !w-auto !min-h-11`} data-testid="avatar-save">
                {busy ? t("සුරකිමින්...") : t("ඡායාරූපය සුරකින්න")}
              </button>
              <button type="button" onClick={() => setPick(null)} disabled={busy} className={`${btnSecondary} !w-auto !min-h-11`}>
                {t("අවලංගු කරන්න")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => input.current?.click()} className={`${btnSecondary} !w-auto !min-h-11`}>
                {currentSrc ? t("ඡායාරූපය වෙනස් කරන්න") : t("ඡායාරූපයක් එක් කරන්න")}
              </button>
              {currentSrc && (
                <button type="button" onClick={remove} disabled={busy} className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50" data-testid="avatar-remove">
                  {t("ඉවත් කරන්න")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

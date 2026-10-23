"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset?: (id: string) => void };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// Cloudflare Turnstile widget. Site key නැතිනම් කිසිවක් නොපෙන්වයි. Widget එක form එක තුළ `cf-turnstile-response` hidden input එකක් එක් කරයි
export function Turnstile() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY) return;
    let id: string | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const mount = () => {
      if (id || !ref.current || !window.turnstile) return false;
      id = window.turnstile.render(ref.current, { sitekey: SITE_KEY });
      return true;
    };
    if (!mount()) timer = setInterval(() => { if (mount() && timer) clearInterval(timer); }, 200);
    // Token එක එක් වරක් පමණක් භාවිතා කළ හැකි නිසා, form එක submit කළ පසු widget එක නැවත සකසයි (අසාර්ථක උත්සාහයකින් පසු අලුත් token එකක් ලබා ගැනීමට)
    const form = ref.current?.closest("form");
    const onSubmit = () => setTimeout(() => { if (id) window.turnstile?.reset?.(id); }, 1500);
    form?.addEventListener("submit", onSubmit);
    return () => {
      form?.removeEventListener("submit", onSubmit);
      if (timer) clearInterval(timer);
      if (id) window.turnstile?.remove(id);
    };
  }, []);
  if (!SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={ref} data-testid="turnstile" className="min-h-16" />
    </>
  );
}

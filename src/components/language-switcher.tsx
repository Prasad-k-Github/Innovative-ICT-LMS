"use client";

import { setLanguageAction } from "@/app/actions/lang";
import { useLang } from "./i18n-provider";

// වත්මන් භාෂාව අනුව අනෙක් භාෂාවට මාරු වීමේ බොත්තම. tone="dark": අඳුරු පසුබිම් සඳහා
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const lang = useLang();
  const next = lang === "en" ? "si" : "en";
  const cls =
    tone === "dark"
      ? "border-white/20 bg-transparent text-white hover:bg-white/10"
      : "border-line bg-white text-ink hover:border-primary/40 hover:bg-primary-soft";
  return (
    <form action={setLanguageAction.bind(null, next)} data-lang>
      <button
        type="submit"
        lang={next}
        aria-label={next === "en" ? "Switch to English" : "සිංහලට මාරු වන්න"}
        className={`min-h-11 rounded-xl border px-3.5 text-sm font-semibold transition ${cls}`}
      >
        {next === "en" ? "English" : "සිංහල"}
      </button>
    </form>
  );
}

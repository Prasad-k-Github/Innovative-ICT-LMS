import { EN } from "./en";

// භාෂා පද්ධතිය: මුල් පාඨය (සිංහල) යතුර ලෙස භාවිතා කරයි. English පරිවර්තනය `en.ts` හි ඇත.
// පරිවර්තනයක් නැතිනම් සිංහල පාඨයම පෙන්වයි.
export const LANG_COOKIE = "ict_lang";
export const LANGS = ["si", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

export function parseLang(value: string | undefined | null): Lang {
  return value === "en" ? "en" : "si";
}

export function makeT(lang: Lang): T {
  return (key, vars) => {
    let s = lang === "en" && Object.hasOwn(EN, key) ? EN[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
    return s;
  };
}

export const DATE_LOCALE: Record<Lang, string> = { si: "si-LK", en: "en-GB" };

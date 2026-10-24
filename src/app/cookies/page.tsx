import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/ui";
import { SESSION_ADMIN_HOURS, SESSION_ADMIN_IDLE_MINUTES, SESSION_DAYS, SESSION_HINT_COOKIE, SESSION_STUDENT_IDLE_DAYS, NEXT_COOKIE } from "@/lib/constants";
import { LANG_COOKIE } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Cookies සහ session") };
}

// Cookies පිළිබඳ විවෘත පැහැදිලි කිරීමක් (login නොකළ අයටත් පෙනේ). අපි භාවිතා කරන්නේ අත්‍යවශ්‍ය cookies පමණි.
export default async function CookiesPage() {
  const t = await getT();
  const rows: { name: string; purpose: string; life: string }[] = [
    { name: "__Host-ict_session", purpose: "Login session එක (HttpOnly, Secure: JavaScript වලට කියවිය නොහැක).", life: t("Logout කරන තුරු, නැතහොත් session කාලය අවසන් වන තුරු") },
    { name: SESSION_HINT_COOKIE, purpose: "ඔබ කලින් login වී සිටි බව පමණක් (රහස් දත්ත නැත). Session කාලය අවසන් වූ විට ඒ බව පෙන්වීමට.", life: t("දින 30") },
    { name: NEXT_COOKIE, purpose: "Login වූ පසු ඔබ සිටි පිටුවටම ආපසු යැවීමට (තාවකාලිකව).", life: t("විනාඩි 10") },
    { name: LANG_COOKIE, purpose: "ඔබ තෝරාගත් භාෂාව (සිංහල / English).", life: t("අවුරුද්දක්") },
  ];
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-5 pb-16 pt-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">{t("Cookies සහ session")}</h1>
          <p className="mt-2 text-muted">{t("Innovative ICT භාවිතා කරන්නේ ඔබට login වී සිටීමට අත්‍යවශ්‍ය cookies පමණි. දැන්වීම්, ලුහුබැඳීම් (tracking) හෝ තෙවන පාර්ශව analytics cookies නැත, එබැවින් cookie අනුමැතිය අසන්නේ නැත.")}</p>
        </div>

        <section className="card space-y-3 p-5" data-testid="cookie-table">
          <h2 className="font-semibold">{t("අපි භාවිතා කරන cookies")}</h2>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.name} className="py-3 text-sm">
                <p className="font-mono text-[13px] font-bold text-navy">{r.name}</p>
                <p className="mt-0.5 text-muted">{t(r.purpose)}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t("කාලය")}: {r.life}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t("ඔබේ browser එකේ (localStorage) ඔබේ ඉල්ලීම් මතක තබා ගැනීමට පමණක් සුළු සැකසුම් ද ගබඩා වේ: side panel සඟවීම, chat කවුළුව විවෘත/වසා තිබීම, තෝරාගත් chat කාමරය සහ අවසන් වරට කියවූ වේලාව. මේවා අපේ server එකට යවන්නේ නැත.")}</p>
        </section>

        <section className="card space-y-3 p-5" data-testid="session-rules">
          <h2 className="font-semibold">{t("Session කාලය")}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{t("සිසුන්: ක්‍රියාකාරී නොවී දින {idle}ක් හෝ login වී දින {max}ක් ගිය විට session එක අවසන් වේ.", { idle: SESSION_STUDENT_IDLE_DAYS, max: SESSION_DAYS })}</li>
            <li>{t("ගුරුතුමා / Admin: ක්‍රියාකාරී නොවී විනාඩි {idle}ක් හෝ login වී පැය {max}ක් ගිය විට අවසන් වේ. අවසන් වීමට මොහොතකට පෙර අනතුරු ඇඟවීමක් පෙන්වයි.", { idle: SESSION_ADMIN_IDLE_MINUTES, max: SESSION_ADMIN_HOURS })}</li>
            <li>{t("ඔබට ඕනෑම වේලාවක ඔබේ ගිණුමේ \"සක්‍රිය sessions\" හි ඕනෑම device එකක් අවසන් කළ හැක. මුරපදය වෙනස් කළ විට සියලු devices වලින් logout වේ.")}</li>
          </ul>
        </section>

        <p className="text-sm text-muted">
          {t("ඔබේ දත්ත ගැන දැනගැනීමට")}:{" "}
          <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">
            {t("පෞද්ගලිකත්ව ප්‍රතිපත්තිය")}
          </Link>
        </p>

        <Link href="/login" className="inline-block text-sm font-semibold text-primary hover:underline">
          {t("ආපසු Login වෙත")}
        </Link>
      </main>
    </div>
  );
}

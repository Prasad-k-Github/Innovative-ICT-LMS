import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/ui";
import { CONTACT, PRIVACY_VERSION } from "@/lib/constants";
import { getLang, getT } from "@/lib/i18n/server";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/lib/privacy-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පෞද්ගලිකත්ව ප්‍රතිපත්තිය") };
}

// Login නොකළ අයටත් (දෙමාපියන්ටත්) පෙනෙන පෞද්ගලිකත්ව ප්‍රතිපත්තිය. අන්තර්ගතය: src/lib/privacy-content.ts
export default async function PrivacyPage() {
  const lang = await getLang();
  const t = await getT();
  const digits = CONTACT.phone.replace(/\D/g, "");
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-5 pb-16 pt-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">{t("පෞද්ගලිකත්ව ප්‍රතිපත්තිය")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("අනුවාදය")}: {PRIVACY_VERSION}
          </p>
          <p className="mt-4 leading-relaxed text-muted">{PRIVACY_INTRO[lang]}</p>
        </div>

        {PRIVACY_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="card space-y-3 p-5" data-testid={`privacy-${s.id}`}>
            <h2 className="font-semibold text-navy">{s.title[lang]}</h2>
            {s.paras?.map((p) => (
              <p key={p.en} className="text-sm leading-relaxed text-muted">
                {p[lang]}
              </p>
            ))}
            {s.items && (
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                {s.items.map((i) => (
                  <li key={i.en}>{i[lang]}</li>
                ))}
              </ul>
            )}
            {s.after && <p className="text-sm font-medium leading-relaxed text-ink">{s.after[lang]}</p>}
          </section>
        ))}

        <section className="card space-y-3 p-5" id="contact" data-testid="privacy-contact">
          <h2 className="font-semibold text-navy">{t("අපව සම්බන්ධ කරගන්න")}</h2>
          <p className="text-sm leading-relaxed text-muted">{t("මෙම ප්‍රතිපත්තිය ගැන ප්‍රශ්න තිබේ නම්, ඔබේ දත්ත බැලීමට, නිවැරදි කිරීමට හෝ මකා දැමීමට අවශ්‍ය නම් අපට දැනුම් දෙන්න.")}</p>
          <ul className="space-y-1 text-sm">
            {CONTACT.email && (
              <li>
                Email:{" "}
                <a href={`mailto:${CONTACT.email}`} className="font-semibold text-primary underline underline-offset-2">
                  {CONTACT.email}
                </a>
              </li>
            )}
            {CONTACT.phone && (
              <li>
                {t("දුරකතන")}:{" "}
                <a href={`tel:+${digits.startsWith("0") ? `94${digits.slice(1)}` : digits}`} className="font-semibold text-primary underline underline-offset-2">
                  {CONTACT.phone}
                </a>
              </li>
            )}
          </ul>
          <p className="text-sm text-muted">
            {t("Cookies ගැන දැනගැනීමට")}:{" "}
            <Link href="/cookies" className="font-semibold text-primary underline underline-offset-2">
              {t("Cookies සහ session")}
            </Link>
          </p>
        </section>

        <Link href="/" className="inline-block text-sm font-semibold text-primary hover:underline">
          {t("මුල් පිටුවට")}
        </Link>
      </main>
    </div>
  );
}

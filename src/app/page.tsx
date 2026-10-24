import Image from "next/image";
import Link from "next/link";
import { AgentLogo, Avatar } from "@/components/cards";
import { Icon, type IconName } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotesMock, PixelBlocks, QuizMock, RecordingMock } from "@/components/landing-visuals";
import { Logo, btnGhostDark, btnSun } from "@/components/ui";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { CLASS_LOCATIONS, CONTACT, TEACHER } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, getPendingStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

// අප සතුව ඇති පහසුකම්
const FACILITIES: { title: string; text?: string; icon: IconName }[] = [
  { title: "HD Recordings", text: "ඕනෑම වේලාවක පාඩම් නැරඹීමේ හැකියාව", icon: "play" },
  { title: "Model Papers & Quiz", text: "ස්වයං ඇගයීම් සඳහා", icon: "quiz" },
  { title: "Smart Assignments & Notes", icon: "clipboard" },
];

const HERO_CHIPS = ["ශ්‍රේණි 6 සිට A/L දක්වා", "සිංහල සහ English මාධ්‍ය", "පන්ති සහ Online"];

const BUDDY_POINTS = [
  "සියලුම ශ්‍රේණි සඳහා, ඔබේ වයසට ගැලපෙන සරල බසින්",
  "ඡායාරූපයක් හෝ PDF එකක් එවා ප්‍රශ්න අසන්න",
  "උත්තරය ඔබටම හිතන්න පොළඹවයි",
];

const JOURNEY: { title: string; text: string }[] = [
  { title: "ලියාපදිංචි වන්න", text: "ඔබේ ශ්‍රේණිය සහ පන්තිය තෝරා ගිණුමක් සාදන්න." },
  { title: "Email තහවුරු කරන්න", text: "ඔබට ලැබෙන ඉලක්කම් 6ක code එක ඇතුළත් කරන්න." },
  { title: "මුරපදය සාදන්න", text: "ඔබේ ගිණුම ආරක්ෂා කරන ශක්තිමත් මුරපදයක් තබන්න." },
  { title: "Admin අනුමැතිය ලබාගන්න", text: "අනුමැතිය ලැබුණු පසු සියලුම පාඩම් ඔබට විවෘතයි." },
];

// CONTACT (constants) වලින් footer සබැඳි සාදයි: හිස් අගයන් සහ https නොවන සමාජ මාධ්‍ය link නොසලකා හරියි
type ContactLink = { label: string; href: string; icon?: IconName; logo?: string; detail?: string; external?: boolean };
// පන්ති ස්ථාන කාඩ්පත් වර්ණ (එක් ස්ථානයකට එක් වර්ණයක්; අකුරු/පසුබිම contrast AA)
const LIGHT = { tile: "bg-navy-950 text-white", sub: "text-white/75", place: "text-white/85", chipA: "bg-navy-950/80 text-white", chipB: "bg-white/20 text-white ring-1 ring-white/30" };
const CLASS_STYLES = [
  { ...LIGHT, card: "from-primary to-[#2b78e0] text-white shadow-[0_24px_50px_-24px_rgb(10_92_194/0.8)]" },
  { ...LIGHT, card: "from-accent to-orange-700 text-white shadow-[0_24px_50px_-24px_rgb(212_0_7/0.7)]" },
  { ...LIGHT, card: "from-emerald-700 to-emerald-600 text-white shadow-[0_24px_50px_-24px_rgb(4_120_87/0.8)]" },
  { ...LIGHT, card: "from-violet-700 to-purple-600 text-white shadow-[0_24px_50px_-24px_rgb(109_40_217/0.8)]" },
  { tile: "bg-navy text-sun", sub: "text-navy/70", place: "text-navy/75", chipA: "bg-navy text-white", chipB: "bg-white/60 text-navy", card: "from-sun to-amber-300 text-navy shadow-[0_24px_50px_-24px_rgb(255_196_46/0.7)]" },
] as const;

function contactLinks(): ContactLink[] {
  const out: ContactLink[] = [];
  // ශ්‍රී ලංකා ඇතුළු අංක: 0769087940 → 94769087940
  const digits = (v: string) => {
    const d = v.replace(/[^\d]/g, "");
    return d.startsWith("0") ? `94${d.slice(1)}` : d;
  };
  if (CONTACT.phone && digits(CONTACT.phone).length >= 9) out.push({ label: "Call", icon: "phone", href: `tel:+${digits(CONTACT.phone)}`, detail: CONTACT.phone });
  if (CONTACT.whatsapp && digits(CONTACT.whatsapp).length >= 9) out.push({ label: "WhatsApp", logo: "/social/whatsapp.png", href: `https://wa.me/${digits(CONTACT.whatsapp)}`, external: true });
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT.email)) out.push({ label: "Email", logo: "/social/gmail.png", href: `mailto:${CONTACT.email}`, detail: CONTACT.email });
  // නිල logo ඇත්තේ Facebook සඳහා පමණි; අනෙක් ඒවාට සාමාන්‍ය icon
  const socials: [string, string, Pick<ContactLink, "icon" | "logo">][] = [
    ["Facebook", CONTACT.facebook, { logo: "/social/facebook.png" }],
    ["YouTube", CONTACT.youtube, { icon: "play" }],
    ["TikTok", CONTACT.tiktok, { icon: "globe" }],
    ["Instagram", CONTACT.instagram, { icon: "globe" }],
  ];
  for (const [label, url, look] of socials) {
    if (url.startsWith("https://")) out.push({ label, href: url, ...look, external: true });
  }
  return out;
}

export default async function Home(props: PageProps<"/">) {
  const t = await getT();
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  // Admin විසින් "පෙන්වන" ලෙස සැකසූ අදහස් පමණි (නැත්නම් කොටස සම්පූර්ණයෙන්ම සැඟවේ)
  const quotes = await db
    .select({ id: testimonials.id, name: testimonials.authorName, info: testimonials.authorInfo, quote: testimonials.quote })
    .from(testimonials)
    .where(and(eq(testimonials.published, true), eq(testimonials.status, "APPROVED")))
    .orderBy(desc(testimonials.createdAt))
    .limit(9);
  const contacts = contactLinks();
  const home = user ? (user.role === "STUDENT" ? "/dashboard" : "/admin") : (await getPendingStudent()) ? "/dashboard" : null;

  const wrap = "mx-auto w-full max-w-[112rem] px-4 sm:px-6 lg:px-10";
  const NAV = [
    { href: "#facilities", label: "අප සතුව ඇති පහසුකම්" },
    { href: "#buddy", label: "ICT මිතුරා" },
    { href: "#journey", label: "ආරම්භ කරන්නේ කොහොමද?" },
    { href: "#classes", label: "පන්ති පවත්වන ස්ථාන" },
  ];
  const cta = home ? (
    <Link href={home} className={btnSun}>
      {t("Dashboard එකට යන්න")}
      <Icon name="arrow" className="h-5 w-5" />
    </Link>
  ) : (
    <>
      <Link href="/register" className={btnSun}>
        {t("ලියාපදිංචි වන්න")}
        <Icon name="arrow" className="h-5 w-5" />
      </Link>
      <Link href="/login" className={btnGhostDark}>
        {t("Login වන්න")}
      </Link>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ඉහළින් සවි වූ (sticky) මෙනුව */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/95 text-white backdrop-blur-xl">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3`}>
            <Logo tone="dark" />
            <nav aria-label={t("ප්‍රධාන මෙනුව")} className="glass hidden items-center gap-1 rounded-full p-1.5 lg:flex">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-white/85 transition hover:bg-white/15 hover:text-white">
                  {t(n.label)}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2.5">
              <LanguageSwitcher tone="dark" />
              <Link href={home ?? "/login"} className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
                {home ? "Dashboard" : "Login"}
              </Link>
            </div>
        </div>
      </header>
      <section aria-label="Innovative ICT" className="mesh-hero pixel-grid relative overflow-hidden pb-24 text-white lg:pb-32">

        <div className={`${wrap} relative z-10 grid items-center gap-14 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12`}>
          <div className="rise">
            {sp.deleted === "1" && (
              <div className="mb-6 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100" role="status">
                {t("ඔබගේ ගිණුම මකා දමන ලදී.")}
              </div>
            )}
            <h1 className="font-display font-bold tracking-tight">
              <span className="glass inline-flex items-center gap-2.5 rounded-full py-2 pl-2.5 pr-5 text-base font-semibold leading-snug text-sun sm:text-lg">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sun text-navy">
                  <Icon name="sparkle" className="h-4 w-4" />
                </span>
                {t("Innovative ICT ඩිජිටල් අවකාශය")}
              </span>
              <span className="text-shine mt-6 block text-[2.9rem] leading-[1.14] sm:text-6xl lg:text-7xl">{t("තාක්ෂණයේ සීමා මායිම් බිඳලන්න")}</span>
            </h1>
            <ul className="mt-9 flex flex-wrap gap-2.5">
              {HERO_CHIPS.map((c) => (
                <li key={c} className="glass rounded-full px-4 py-2 text-sm font-medium text-white/90">
                  {t(c)}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">{cta}</div>
          </div>

          {/* ගුරුවරයාගේ ඡායාරූපය: පික්සල් කොටු සහ පාවෙන කාඩ්පත් */}
          <div className="rise relative mx-auto w-full max-w-sm [animation-delay:150ms] lg:max-w-md">
            <PixelBlocks className="absolute -bottom-6 -left-10 z-0" />
            <PixelBlocks className="absolute -right-8 -top-8 z-0 rotate-180" />
            <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-t-[999px] rounded-b-[2rem] border-2 border-sun/50" aria-hidden="true" />
            <div className="relative z-10 aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-sun shadow-[0_40px_80px_-30px_rgb(255_196_46/0.55)]">
              <Image src="/teacher.jpg" alt={t("Innovative ICT ගුරුවරයා")} fill sizes="(min-width: 1024px) 28rem, 24rem" className="object-cover" priority />
            </div>
            <div className="float-a absolute left-2 bottom-10 z-20 max-w-[92%] rounded-2xl bg-white p-3.5 text-navy sm:p-4 shadow-[0_24px_40px_-18px_rgb(0_0_0/0.6)] sm:-left-10">
              <p className="text-sm font-semibold text-accent">{TEACHER.title}</p>
              <p className="mt-1 font-display text-lg font-bold leading-tight">{TEACHER.name}</p>
              <p className="text-sm font-semibold text-navy/80">{TEACHER.role}</p>
            </div>
            <div className="float-b absolute left-2 top-16 z-20 flex items-center gap-3 rounded-2xl bg-navy-950/90 py-2.5 pl-2.5 pr-4 text-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.7)] ring-1 ring-white/20 backdrop-blur sm:-left-12">
              <AgentLogo size="sm" />
              <span>
                <span className="block text-sm font-bold leading-tight">{t("ICT මිතුරා")}</span>
                <span className="flex items-center gap-1.5 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  {t("ඕනෑම වෙලාවක")}
                </span>
              </span>
            </div>
            <div className="float-a absolute -right-1 bottom-28 z-20 flex items-center gap-2.5 rounded-2xl bg-navy-950/90 px-3.5 py-2.5 text-sm font-bold text-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.7)] ring-1 ring-white/20 backdrop-blur sm:-right-8">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sun text-navy">
                <Icon name="play" className="h-5 w-5" />
              </span>
              HD Recordings
            </div>
          </div>
        </div>
      </section>

      <main className="relative flex-1">
        {/* ඉගෙනීමේ Smart විප්ලවය */}
        <section id="facilities" className="relative -mt-14 scroll-mt-20 rounded-t-[2.5rem] bg-surface pb-6 pt-14 lg:-mt-20 lg:rounded-t-[4rem] lg:pt-20">
          <div className={wrap}>
            <h2 className="max-w-3xl text-3xl font-bold leading-tight text-navy sm:text-5xl sm:leading-[1.15]">{t("ඉගෙනීමේ Smart විප්ලවය - සියල්ල එකම තැනකින්!")}</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
              {t("පන්තියේදී ඉගෙන ගත් දේ ගෙදරදීත් නිවැරදිව හා ස්ථිරව මතක තබාගන්න. ඔබේ අධ්‍යාපන ගමන පහසු කරවන Digital අධ්‍යාපනික එකතුව!")}
            </p>

            <h3 className="mt-12 font-display text-2xl font-bold text-navy">{t("අප සතුව ඇති පහසුකම්")}</h3>
            <ul className="mt-6 grid gap-6 lg:grid-cols-3">
              {FACILITIES.map((f, i) => {
                const look = [
                  { card: "bg-navy-950 text-white ring-1 ring-white/10", tile: "bg-sun text-navy", title: "text-white", text: "text-white/70", visual: <RecordingMock /> },
                  { card: "bg-primary-soft", tile: "bg-primary text-white", title: "text-navy", text: "text-navy/70", visual: <QuizMock /> },
                  { card: "bg-sun-soft", tile: "bg-navy text-sun", title: "text-navy", text: "text-navy/70", visual: <NotesMock /> },
                ][i];
                return (
                  <li key={f.title} className={`group flex flex-col gap-7 overflow-hidden rounded-[2rem] p-6 transition duration-300 hover:-translate-y-1.5 sm:p-7 ${look.card}`}>
                    <div className="transition duration-300 group-hover:scale-[1.02]">{look.visual}</div>
                    <div className="flex items-start gap-4">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${look.tile}`}>
                        <Icon name={f.icon} className="h-6 w-6" />
                      </span>
                      <div>
                        <p className={`text-xl font-bold leading-snug ${look.title}`}>{t(f.title)}</p>
                        {f.text && <p className={`mt-1.5 leading-relaxed ${look.text}`}>{t(f.text)}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ICT මිතුරා */}
        <section id="buddy" className="mesh-hero pixel-grid relative mt-14 scroll-mt-20 overflow-hidden text-white lg:mt-20">
          <div className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] rounded-full bg-primary/30 blur-3xl" aria-hidden="true" />
          <div className={`${wrap} relative grid items-center gap-14 py-20 lg:grid-cols-[1fr_0.9fr] lg:py-28`}>
            <div>
              <AgentLogo size="lg" />
              <h2 className="mt-6 text-3xl font-bold leading-tight sm:text-5xl sm:leading-[1.15]">{t("ඔබේම ICT මිතුරා, ඕනෑම වෙලාවක")}</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
                {t("ICT ගැන ඕනෑම ප්‍රශ්නයක් අසන්න. ඔබටම ගැලපෙන සරල බසින් පැහැදිලි කරන, ඔබත් එක්ක හිතලා ඉගෙන ගන්න මිතුරෙක්.")}
              </p>
              <ul className="mt-8 space-y-3.5">
                {BUDDY_POINTS.map((b) => (
                  <li key={b} className="glass flex items-center gap-3.5 rounded-2xl px-4 py-3 text-white/95">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sun text-navy">
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                    {t(b)}
                  </li>
                ))}
              </ul>
            </div>

            {/* උදාහරණ සංවාදයක් (නිදර්ශනයකි) */}
            <figure className="mx-auto w-full max-w-md" aria-label={t("ICT මිතුරාගේ උදාහරණ සංවාදයක්")}>
              <div className="glass rounded-[2rem] p-5 sm:p-6">
                <div className="flex items-center gap-3 border-b border-white/15 pb-4">
                  <AgentLogo size="sm" />
                  <span className="text-sm font-bold">{t("ICT මිතුරා")}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-white/75">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                    Online
                  </span>
                </div>
                <div className="mt-5 flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed shadow-lg">{t("RAM සහ Hard Disk අතර වෙනස මොකක්ද?")}</p>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <AgentLogo size="sm" />
                  <p className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-relaxed text-navy shadow-lg">
                    {t("හොඳ ප්‍රශ්නයක්! RAM කියන්නේ තාවකාලික මතකයයි, Hard Disk එක ස්ථිර ගබඩාවයි. දැන් ඔබට කියන්න පුළුවන්ද, ඇයි RAM එකට power නැතිවුණාම දත්ත නැති වෙන්නේ?")}
                  </p>
                </div>
                <div className="mt-4 flex justify-end" aria-hidden="true">
                  <span className="typing rounded-2xl rounded-br-md bg-primary/70 px-4 py-3 text-white/90">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-white/60">{t("උදාහරණ සංවාදයක් පමණි")}</figcaption>
            </figure>
          </div>
        </section>

        {quotes.length > 0 && (
          <section className={`${wrap} py-16 lg:py-24`} data-testid="testimonials">
            <h2 className="text-3xl font-bold text-navy sm:text-5xl">{t("සිසුන් කියන්නේ මොනවාද?")}</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted">{t("අපේ සිසුන්ගේ සහ දෙමාපියන්ගේ ම වචන වලින්.")}</p>
            <ul className="mt-10 gap-6 [column-fill:_balance] md:columns-2 lg:columns-3">
              {quotes.map((q, i) => (
                <li key={q.id} className={`mb-6 break-inside-avoid rounded-[2rem] p-7 transition duration-300 hover:-translate-y-1 ${["card", "bg-primary-soft", "bg-sun-soft"][i % 3]}`}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sun">
                    <Icon name="quote" className="h-5 w-5" />
                  </span>
                  <blockquote className="mt-4 whitespace-pre-line text-lg leading-relaxed text-navy [overflow-wrap:anywhere]">{q.quote}</blockquote>
                  <div className="mt-6 flex items-center gap-3">
                    <Avatar name={q.name} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-navy [overflow-wrap:anywhere]">{q.name}</p>
                      {q.info && <p className="text-sm text-muted [overflow-wrap:anywhere]">{q.info}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ආරම්භ කරන ආකාරය: සැබෑ පියවර පිළිවෙලක් */}
        <section id="journey" className={`${wrap} scroll-mt-20 py-16 lg:py-24`}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-3xl font-bold text-navy sm:text-5xl sm:leading-[1.15]">{t("ආරම්භ කරන්නේ කොහොමද?")}</h2>
              <p className="mt-4 max-w-md text-lg text-muted">{t("විනාඩි කිහිපයකින් ඔබේ ගිණුම සූදානම්.")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                {home ? (
                  <Link href={home} className={btnSun}>
                    {t("Dashboard එකට යන්න")}
                    <Icon name="arrow" className="h-5 w-5" />
                  </Link>
                ) : (
                  <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 py-3 text-base font-bold text-white transition hover:bg-primary">
                    {t("ලියාපදිංචි වන්න")}
                    <Icon name="arrow" className="h-5 w-5" />
                  </Link>
                )}
              </div>
            </div>
            <ol className="space-y-6">
              {JOURNEY.map((j, i) => (
                <li key={j.title} className={`relative flex gap-5 ${i < JOURNEY.length - 1 ? "step-line" : ""}`}>
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sun font-display text-lg font-bold text-navy shadow-[0_10px_20px_-10px_rgb(255_196_46/0.9)]">{i + 1}</span>
                  <div className="card flex-1 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                    <h3 className="text-lg font-bold text-navy">{t(j.title)}</h3>
                    <p className="mt-1.5 leading-relaxed text-muted">{t(j.text)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ගුරුවරයා */}
        <section className={`${wrap} pb-16 lg:pb-24`}>
          <div className="mesh-hero pixel-grid relative grid gap-8 overflow-hidden rounded-[2.5rem] p-8 text-white lg:grid-cols-[auto_1fr] lg:items-center lg:gap-14 lg:p-14">
            <div className="relative mx-auto lg:mx-0">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-t-[999px] rounded-b-3xl border-2 border-sun/50" aria-hidden="true" />
              <Image src="/teacher.jpg" alt="" width={256} height={320} className="relative h-56 w-44 rounded-t-[999px] rounded-b-3xl bg-sun object-cover lg:h-72 lg:w-56" />
            </div>
            <div>
              <h2 className="text-3xl font-bold sm:text-5xl">{t("ඔබේ ICT ගුරුවරයා")}</h2>
              <p className="mt-3 font-display text-2xl font-bold text-sun">{TEACHER.name}</p>
              <p className="text-sm font-semibold text-white/75">{TEACHER.title}</p>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
                {t("ක්ෂේත්‍රයේ වසර 3+ ක ප්‍රායෝගික පළපුරුද්ද සමඟින්, සංකීර්ණ ICT සංකල්ප ඉතාම සරලව සහ පැහැදිලිව ඔබ වෙත අරන් එන විශ්වාසනීය මඟපෙන්වන්නා")}
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold">
                  <Icon name="check" className="h-4 w-4 text-sun" />
                  {TEACHER.role}
                </span>
                <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold">
                  <Icon name="check" className="h-4 w-4 text-sun" />
                  {t("ශ්‍රේණි 6 සිට A/L දක්වා")}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* පන්ති පවත්වන ස්ථාන */}
        <section id="classes" className={`${wrap} scroll-mt-20 pb-16 lg:pb-24`}>
          <div className="mesh-hero pixel-grid relative overflow-hidden rounded-[2.5rem] px-5 py-12 text-white sm:px-10 lg:px-14 lg:py-16">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-bold sm:text-5xl">{t("පන්ති පවත්වන ස්ථාන")}</h2>
                <p className="mt-3 max-w-2xl text-lg text-white/75">{t("ඔබට ආසන්නම පන්තිය තෝරාගන්න, නැතිනම් Online එකෙන් සම්බන්ධ වෙන්න.")}</p>
              </div>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
              {CLASS_LOCATIONS.map((c, i) => {
                const [brand, area] = c.name.split(" - ");
                const sc = CLASS_STYLES[i % CLASS_STYLES.length];
                return (
                  <li key={c.name} className={`${i >= 3 ? "lg:col-span-3" : "lg:col-span-2"} ${i === CLASS_LOCATIONS.length - 1 && i % 2 === 0 ? "sm:col-span-2" : ""}`}>
                    <article className={`h-full rounded-3xl bg-gradient-to-br p-6 transition duration-300 hover:-translate-y-1 ${sc.card}`}>
                      <div className="flex items-start gap-4">
                        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg ${sc.tile}`}>
                          <Icon name={c.name === "Online" ? "globe" : "pin"} className="h-7 w-7" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-display text-xl font-bold leading-tight">
                            {brand}
                            {area && <span className={sc.sub}> · {area}</span>}
                          </h3>
                          <p className={`mt-1 text-sm font-medium ${sc.place}`}>{t(c.place)}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${sc.chipA}`}>{t(c.grades)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${sc.chipB}`}>{t(c.medium)}</span>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* අවසාන ඇරයුම */}
        <section className={`${wrap} pb-16 lg:pb-24`}>
          <div className="mesh-hero pixel-grid relative overflow-hidden rounded-[2.5rem] px-8 py-16 text-center text-white sm:px-12 lg:py-24">
            <PixelBlocks className="absolute -bottom-3 -left-3 hidden sm:grid" />
            <PixelBlocks className="absolute -right-3 -top-3 hidden rotate-180 sm:grid" />
            <h2 className="text-shine relative mx-auto max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl sm:leading-[1.12]">{t("අදම ඔබේ ICT ගමන ආරම්භ කරන්න")}</h2>
            <p className="relative mx-auto mt-5 max-w-xl text-lg text-white/75">{t("හොඳ අඩිතාලමක් තියෙන ICT දැනුමක්, ඔබේ අනාගතයේ ලොකුම වාසියක්.")}</p>
            <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">{cta}</div>
          </div>
        </section>
      </main>

      <footer className="bg-navy-950 py-10 text-center text-sm text-white/60">
        {contacts.length > 0 && (
          <nav aria-label={t("සම්බන්ධ වන්න")} className="mx-auto mb-8 max-w-[112rem] px-4">
            <p className="font-display text-base font-bold text-white">{t("අප හා සම්බන්ධ වන්න")}</p>
            <ul className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {contacts.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-white/20 py-2 pl-2.5 pr-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center text-sun">
                      {c.logo ? <Image src={c.logo} alt="" width={160} height={160} style={{ height: 22, width: "auto" }} /> : c.icon && <Icon name={c.icon} className="h-[22px] w-[22px]" />}
                    </span>
                    {c.label}
                    {c.detail && <span className="font-normal text-white/60">{c.detail}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <p>© {new Date().getFullYear()} Innovative ICT</p>
        <p className="mt-1 text-white/60">{TEACHER.name}</p>
        <p className="mt-2">
          <Link href="/cookies" className="inline-flex min-h-8 items-center text-white/60 underline underline-offset-2 hover:text-white">
            {t("Cookies සහ session")}
          </Link>
        </p>
      </footer>
    </div>
  );
}

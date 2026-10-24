import Image from "next/image";
import Link from "next/link";
import { AgentLogo, Avatar, Chip, Tile, ToneCard, toneAt } from "@/components/cards";
import { Icon, type IconName } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
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
  "උත්තරය කෙලින්ම නොදී, ඔබටම හිතන්න පොළඹවයි",
  "Quiz කරන විට උදව් නොකරයි: ඔබේ ලකුණු ඔබේම",
];

const JOURNEY: { title: string; text: string }[] = [
  { title: "ලියාපදිංචි වන්න", text: "ඔබේ ශ්‍රේණිය සහ පන්තිය තෝරා ගිණුමක් සාදන්න." },
  { title: "Email තහවුරු කරන්න", text: "ඔබට ලැබෙන ඉලක්කම් 6ක code එක ඇතුළත් කරන්න." },
  { title: "මුරපදය සාදන්න", text: "ඔබේ ගිණුම ආරක්ෂා කරන ශක්තිමත් මුරපදයක් තබන්න." },
  { title: "Admin අනුමැතිය ලබාගන්න", text: "අනුමැතිය ලැබුණු පසු සියලුම පාඩම් ඔබට විවෘතයි." },
];

// CONTACT (constants) වලින් footer සබැඳි සාදයි: හිස් අගයන් සහ https නොවන සමාජ මාධ්‍ය link නොසලකා හරියි
function contactLinks(): { label: string; href: string; detail?: string; external?: boolean }[] {
  const out: { label: string; href: string; detail?: string; external?: boolean }[] = [];
  // ශ්‍රී ලංකා ඇතුළු අංක: 0769087940 → 94769087940
  const digits = (v: string) => {
    const d = v.replace(/[^\d]/g, "");
    return d.startsWith("0") ? `94${d.slice(1)}` : d;
  };
  if (CONTACT.phone && digits(CONTACT.phone).length >= 9) out.push({ label: "Call", href: `tel:+${digits(CONTACT.phone)}`, detail: CONTACT.phone });
  if (CONTACT.whatsapp && digits(CONTACT.whatsapp).length >= 9) out.push({ label: "WhatsApp", href: `https://wa.me/${digits(CONTACT.whatsapp)}`, external: true });
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT.email)) out.push({ label: "Email", href: `mailto:${CONTACT.email}`, detail: CONTACT.email });
  for (const [label, url] of [["Facebook", CONTACT.facebook], ["YouTube", CONTACT.youtube], ["TikTok", CONTACT.tiktok], ["Instagram", CONTACT.instagram]] as const) {
    if (url.startsWith("https://")) out.push({ label, href: url, external: true });
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

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Hero: navy පසුබිම, pixel grid, කහ පසුබිමේ ගුරුවරයාගේ ඡායාරූපය */}
      <section aria-label="Innovative ICT" className="pixel-grid relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute -left-40 top-1/3 h-[460px] w-[460px] rounded-full bg-primary/30 blur-3xl" aria-hidden="true" />
        <header className="relative mx-auto flex w-full max-w-[112rem] items-center justify-between px-4 py-5 sm:px-6 lg:px-10">
          <Logo tone="dark" />
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher tone="dark" />
            <Link href={home ?? "/login"} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-white hover:bg-white/10">
              {home ? "Dashboard" : "Login"}
            </Link>
          </div>
        </header>

        <div className="relative mx-auto grid w-full max-w-[112rem] items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-10">
          <div className="rise">
            {sp.deleted === "1" && (
              <div className="mb-6 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100" role="status">
                {t("ඔබගේ ගිණුම මකා දමන ලදී.")}
              </div>
            )}
            <h1 className="font-display font-bold tracking-tight">
              <span className="block text-xl leading-snug text-sun sm:text-2xl">{t("Innovative ICT ඩිජිටල් අවකාශය")}</span>
              <span className="mt-3 block text-5xl leading-[1.12] sm:text-6xl lg:text-7xl">{t("තාක්ෂණයේ සීමා මායිම් බිඳලන්න")}</span>
            </h1>
            <ul className="mt-8 flex flex-wrap gap-2">
              {HERO_CHIPS.map((c) => (
                <li key={c} className="rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/85">
                  {t(c)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {home ? (
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
              )}
            </div>
          </div>

          <div className="rise relative mx-auto w-full max-w-sm [animation-delay:120ms] lg:max-w-md">
            <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-t-[999px] rounded-b-[2rem] border-2 border-white/20" aria-hidden="true" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-sun">
              <Image
                src="/teacher.jpg"
                alt={t("Innovative ICT ගුරුවරයා")}
                fill
                sizes="(min-width: 1024px) 28rem, 24rem"
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute -left-3 bottom-8 max-w-[85%] rounded-2xl bg-white p-4 text-navy shadow-[0_24px_40px_-18px_rgb(0_0_0/0.6)] sm:-left-8">
              <p className="text-sm font-semibold text-accent">{TEACHER.title}</p>
              <p className="mt-1 font-display text-lg font-bold leading-tight">{TEACHER.name}</p>
              <p className="text-sm font-semibold text-navy/80">{TEACHER.role}</p>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* ඉගෙනීමේ Smart විප්ලවය */}
        <section className="mx-auto w-full max-w-[112rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <h2 className="max-w-3xl text-3xl font-bold leading-tight text-navy sm:text-4xl">{t("ඉගෙනීමේ Smart විප්ලවය - සියල්ල එකම තැනකින්!")}</h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
            {t("පන්තියේදී ඉගෙන ගත් දේ ගෙදරදීත් නිවැරදිව හා ස්ථිරව මතක තබාගන්න. ඔබේ අධ්‍යාපන ගමන පහසු කරවන Digital අධ්‍යාපනික එකතුව!")}
          </p>

          <h3 className="mt-10 font-display text-xl font-bold text-navy">{t("අප සතුව ඇති පහසුකම්")}</h3>
          <ul className="mt-5 grid gap-5 lg:grid-cols-3">
            {FACILITIES.map((f, i) => {
              const look = [
                { card: "pixel-grid-soft bg-primary-soft", tile: "bg-primary text-white", title: "text-navy", text: "text-navy/70" },
                { card: "bg-navy text-white", tile: "bg-white/10 text-sun", title: "text-white", text: "text-white/70" },
                { card: "bg-sun-soft", tile: "bg-sun text-navy", title: "text-navy", text: "text-navy/70" },
              ][i];
              return (
                <li key={f.title} className={`flex items-start gap-5 rounded-[1.75rem] p-7 ${look.card}`}>
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${look.tile}`}>
                    <Icon name={f.icon} className="h-7 w-7" />
                  </span>
                  <div>
                    <p className={`text-xl font-bold leading-snug ${look.title}`}>{t(f.title)}</p>
                    {f.text && <p className={`mt-2 leading-relaxed ${look.text}`}>{t(f.text)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ICT මිතුරා */}
        <section className="pixel-grid relative overflow-hidden bg-navy-950 text-white">
          <div className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-[112rem] items-center gap-12 px-4 py-16 sm:px-6 lg:px-10 lg:grid-cols-[1fr_0.9fr] lg:py-24">
            <div>
              <AgentLogo size="lg" />
              <h2 className="mt-6 text-3xl font-bold leading-tight sm:text-4xl">{t("ඔබේම ICT මිතුරා, ඕනෑම වෙලාවක")}</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
                {t("ICT ගැන ඕනෑම ප්‍රශ්නයක් අසන්න. ඔබටම ගැලපෙන සරල බසින් පැහැදිලි කරන, ඔබත් එක්ක හිතලා ඉගෙන ගන්න මිතුරෙක්.")}
              </p>
              <ul className="mt-7 space-y-3">
                {BUDDY_POINTS.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-white/90">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun text-navy">
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                    {t(b)}
                  </li>
                ))}
              </ul>
            </div>

            {/* උදාහරණ සංවාදයක් (නිදර්ශනයකි) */}
            <figure className="mx-auto w-full max-w-md" aria-label={t("ICT මිතුරාගේ උදාහරණ සංවාදයක්")}>
              <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed">{t("RAM සහ Hard Disk අතර වෙනස මොකක්ද?")}</p>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <AgentLogo size="sm" />
                  <p className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-relaxed text-navy">
                    {t("හොඳ ප්‍රශ්නයක්! RAM කියන්නේ තාවකාලික මතකයයි, Hard Disk එක ස්ථිර ගබඩාවයි. දැන් ඔබට කියන්න පුළුවන්ද, ඇයි RAM එකට power නැතිවුණාම දත්ත නැති වෙන්නේ?")}
                  </p>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-white/50">{t("උදාහරණ සංවාදයක් පමණි")}</figcaption>
            </figure>
          </div>
        </section>

        {quotes.length > 0 && (
          <section className="mx-auto w-full max-w-[112rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20" data-testid="testimonials">
            <h2 className="text-3xl font-bold text-navy sm:text-4xl">{t("සිසුන් කියන්නේ මොනවාද?")}</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted">{t("අපේ සිසුන්ගේ සහ දෙමාපියන්ගේ ම වචන වලින්.")}</p>
            <ul className="mt-10 gap-5 [column-fill:_balance] md:columns-2 lg:columns-3">
              {quotes.map((q, i) => (
                <li key={q.id} className={`mb-5 break-inside-avoid rounded-[1.75rem] p-7 ${["card", "bg-primary-soft", "bg-sun-soft"][i % 3]}`}>
                  <Icon name="quote" className="h-8 w-8 text-accent/70" />
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
        <section className="mx-auto w-full max-w-[112rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <h2 className="text-3xl font-bold text-navy sm:text-4xl">{t("ආරම්භ කරන්නේ කොහොමද?")}</h2>
          <p className="mt-3 max-w-2xl text-lg text-muted">{t("විනාඩි කිහිපයකින් ඔබේ ගිණුම සූදානම්.")}</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((j, i) => (
              <li key={j.title} className="card relative p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sun font-display text-lg font-bold text-navy">{i + 1}</span>
                <h3 className="mt-4 text-lg font-bold text-navy">{t(j.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(j.text)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ගුරුවරයා */}
        <section className="mx-auto w-full max-w-[112rem] px-4 pb-14 sm:px-6 lg:px-10 lg:pb-20">
          <div className="grid gap-8 overflow-hidden rounded-[2rem] bg-white p-8 shadow-[var(--shadow-card)] lg:grid-cols-[auto_1fr] lg:items-center lg:gap-12 lg:p-12">
            <Image src="/teacher.jpg" alt="" width={176} height={176} className="h-36 w-36 rounded-full bg-sun object-cover ring-4 ring-sun-soft lg:h-44 lg:w-44" />
            <div>
              <h2 className="text-3xl font-bold text-navy sm:text-4xl">{t("ඔබේ ICT ගුරුවරයා")}</h2>
              <p className="mt-1 font-display text-xl font-bold text-accent">{TEACHER.name}</p>
              <p className="text-sm font-semibold text-navy/70">{TEACHER.title}</p>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
                {t("ක්ෂේත්‍රයේ වසර 3+ ක ප්‍රායෝගික පළපුරුද්ද සමඟින්, සංකීර්ණ ICT සංකල්ප ඉතාම සරලව සහ පැහැදිලිව ඔබ වෙත අරන් එන විශ්වාසනීය මඟපෙන්වන්නා")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Chip tone="blue" icon="check">{TEACHER.role}</Chip>
                <Chip tone="sun" icon="check">{t("ශ්‍රේණි 6 සිට A/L දක්වා")}</Chip>
              </div>
            </div>
          </div>
        </section>

        {/* පන්ති පවත්වන ස්ථාන */}
        <section className="mx-auto w-full max-w-[112rem] px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
          <h2 className="text-3xl font-bold text-navy sm:text-4xl">{t("පන්ති පවත්වන ස්ථාන")}</h2>
          <p className="mt-3 max-w-2xl text-lg text-muted">{t("ඔබට ආසන්නම පන්තිය තෝරාගන්න, නැතිනම් Online එකෙන් සම්බන්ධ වෙන්න.")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CLASS_LOCATIONS.map((c, i) => (
              <li key={c.name}>
                <ToneCard tone={toneAt(i)} className="h-full space-y-4 p-5 pt-6">
                  <div className="flex items-start gap-3.5">
                    <Tile icon="building" tone={toneAt(i)} size="lg" />
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold leading-snug text-navy">{c.name}</p>
                      <p className="mt-0.5 text-sm text-muted">{t(c.place)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="blue">{t(c.grades)}</Chip>
                    <Chip tone="red">{t(c.medium)}</Chip>
                  </div>
                </ToneCard>
              </li>
            ))}
          </ul>
        </section>

        {/* අවසාන ඇරයුම */}
        <section className="mx-auto w-full max-w-[112rem] px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
          <div className="pixel-grid relative overflow-hidden rounded-[2rem] bg-navy-950 px-8 py-12 text-center text-white sm:px-12 lg:py-16">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
            <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">{t("අදම ඔබේ ICT ගමන ආරම්භ කරන්න")}</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">{t("හොඳ අඩිතාලමක් තියෙන ICT දැනුමක්, ඔබේ අනාගතයේ ලොකුම වාසියක්.")}</p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {home ? (
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
              )}
            </div>
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
                    className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    {c.label}
                    {c.detail && <span className="ml-2 font-normal text-white/60">{c.detail}</span>}
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

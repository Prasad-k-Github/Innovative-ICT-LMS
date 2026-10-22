import Image from "next/image";
import Link from "next/link";
import { Chip, Tile, ToneCard, toneAt } from "@/components/cards";
import { Icon, type IconName } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo, btnGhostDark, btnSun } from "@/components/ui";
import { CLASS_LOCATIONS, TEACHER } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, getPendingStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

const features: { title: string; text: string; icon: IconName }[] = [
  { title: "පාඩමෙන් පාඩම", text: "ඔබේ ශ්‍රේණියට අදාළ පාඩම්, පෙළපොත සහ නිබන්ධන එක තැනක.", icon: "layers" },
  { title: "Past & Model Papers", text: "වසර අනුව Past Papers සහ Model Papers පහසුවෙන් සොයාගන්න.", icon: "papers" },
  { title: "Recordings සහ Notes", text: "පන්ති Recordings සහ අමතර Notes ඕනෑම වෙලාවක බලන්න.", icon: "play" },
  { title: "Quiz", text: "කාලය සහිතව Quiz කර, ඔබේ ප්‍රගතිය ලකුණු සහිතව බලන්න.", icon: "quiz" },
  { title: "පැවරුම්", text: "ගුරුතුමා දෙන පැවරුම් බලා, අන්තර්ජාලයෙන්ම භාරදෙන්න.", icon: "clipboard" },
  { title: "Online පන්ති", text: "Zoom හරහා පන්තියට සම්බන්ධ වෙන්න. link එක ඔබේ Dashboard එකේම.", icon: "users" },
];

const HERO_CHIPS = ["ශ්‍රේණි 6 සිට A/L දක්වා", "සිංහල සහ English මාධ්‍ය", "පන්ති සහ Online"];

const STATS: { value: string; label: string }[] = [
  { value: "6 – A/L", label: "ශ්‍රේණි සියල්ලටම" },
  { value: String(CLASS_LOCATIONS.length), label: "පන්ති ස්ථාන (Online ද ඇතුළුව)" },
  { value: "2", label: "මාධ්‍ය: සිංහල සහ English" },
  { value: "24/7", label: "ICT මිතුරාගෙන් ඕනෑම වෙලාවක අසන්න" },
];

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

export default async function Home(props: PageProps<"/">) {
  const t = await getT();
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  const home = user ? (user.role === "STUDENT" ? "/dashboard" : "/admin") : (await getPendingStudent()) ? "/dashboard" : null;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Hero: navy පසුබිම, pixel grid, කහ පසුබිමේ ගුරුවරයාගේ ඡායාරූපය */}
      <section className="pixel-grid relative overflow-hidden bg-navy-950 text-white">
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
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">{t("ICT ඉගෙනීම, වඩා සරලව.")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              {t("ICT විෂය සඳහා සරල, පහසු ඉගෙනුම් පද්ධතිය. ඔබගේ ශ්‍රේණියට අදාළ සියල්ල එකම තැනකින්.")}
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
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
              <p className="font-display text-lg font-bold leading-tight">{TEACHER.name}</p>
              <p className="mt-1 text-sm font-semibold text-accent">{TEACHER.title}</p>
              <p className="text-sm font-semibold text-navy/80">{TEACHER.role}</p>
              <p className="mt-1 text-xs leading-snug text-muted">{TEACHER.details[1]}</p>
            </div>
          </div>
        </div>
      </section>

      {/* සත්‍ය තොරතුරු: අංක සියල්ල constants වලින් */}
      <section className="border-b border-line bg-white">
        <dl className="mx-auto grid max-w-[112rem] grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:grid-cols-4">
          {STATS.map((x, i) => (
            <div key={x.label} className={`px-2 ${i > 0 ? "lg:border-l lg:border-line lg:pl-8" : ""}`}>
              <dt className="sr-only">{t(x.label)}</dt>
              <dd>
                <span className="font-display text-3xl font-bold tracking-tight text-navy sm:text-4xl">{x.value}</span>
                <span className="mt-1 block text-sm leading-snug text-muted">{t(x.label)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <main className="flex-1">
        {/* ඉගෙනීමට අවශ්‍ය සියල්ල */}
        <section className="mx-auto w-full max-w-[112rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <h2 className="max-w-2xl text-3xl font-bold leading-tight text-navy sm:text-4xl">{t("ඉගෙනීමට අවශ්‍ය සියල්ල, එකම තැනක")}</h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">{t("පන්තියේදී ඉගෙන ගත් දේ ගෙදරදී ස්ථිර කරගන්න: පාඩම්, Papers, Recordings, Quiz සහ පැවරුම් ඔබේ ෆෝන් එකෙන්ම.")}</p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="pixel-grid-soft flex flex-col justify-between rounded-[2rem] bg-primary-soft p-8 lg:row-span-2 lg:min-h-[360px]">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
                <Icon name={features[0].icon} className="h-7 w-7" />
              </span>
              <div className="mt-10">
                <h3 className="text-3xl font-bold text-navy">{t(features[0].title)}</h3>
                <p className="mt-3 leading-relaxed text-navy/70">{t(features[0].text)}</p>
              </div>
            </div>
            <div className="card flex items-start gap-5 p-7 lg:col-span-2">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                <Icon name={features[1].icon} className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-navy">{t(features[1].title)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{t(features[1].text)}</p>
              </div>
            </div>
            <div className="flex items-start gap-5 rounded-[1.75rem] bg-sun-soft p-7 lg:col-span-2">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sun text-navy">
                <Icon name={features[2].icon} className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-navy">{t(features[2].title)}</h3>
                <p className="mt-2 leading-relaxed text-navy/70">{t(features[2].text)}</p>
              </div>
            </div>
            {features.slice(3).map((f, i) => (
              <div key={f.title} className={`rounded-[1.75rem] p-7 ${["bg-accent-soft", "card", "bg-navy text-white"][i]}`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${["bg-accent text-white", "bg-primary text-white", "bg-white/10 text-sun"][i]}`}>
                  <Icon name={f.icon} className="h-6 w-6" />
                </span>
                <h3 className={`mt-5 text-xl font-bold ${i === 2 ? "text-white" : "text-navy"}`}>{t(f.title)}</h3>
                <p className={`mt-2 leading-relaxed ${i === 2 ? "text-white/70" : "text-navy/70"}`}>{t(f.text)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ICT මිතුරා */}
        <section className="pixel-grid relative overflow-hidden bg-navy-950 text-white">
          <div className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-[112rem] items-center gap-12 px-4 py-16 sm:px-6 lg:px-10 lg:grid-cols-[1fr_0.9fr] lg:py-24">
            <div>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/40">
                <Icon name="sparkle" className="h-7 w-7" />
              </span>
              <h2 className="mt-6 text-3xl font-bold leading-tight sm:text-4xl">{t("ඔබේම ICT මිතුරා, ඕනෑම වෙලාවක")}</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
                {t("ICT ගැන ඕනෑම ප්‍රශ්නයක් අසන්න. ඔබේ ශ්‍රේණියට ගැලපෙන සරල බසින්, ආදරයෙන් පැහැදිලි කරන, ඔබත් එක්ක හිතලා ඉගෙන ගන්න මිතුරෙක්.")}
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
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
                    <Icon name="sparkle" className="h-4.5 w-4.5" />
                  </span>
                  <p className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-relaxed text-navy">
                    {t("හොඳ ප්‍රශ්නයක්! RAM කියන්නේ තාවකාලික මතකයයි, Hard Disk එක ස්ථිර ගබඩාවයි. දැන් ඔබට කියන්න පුළුවන්ද, ඇයි RAM එකට power නැතිවුණාම දත්ත නැති වෙන්නේ?")}
                  </p>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-white/50">{t("උදාහරණ සංවාදයක් පමණි")}</figcaption>
            </figure>
          </div>
        </section>

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
                {t("Software Engineering ක්ෂේත්‍රයේ වෘත්තීය අත්දැකීම් සහ NIBM හි Higher National Diploma සුදුසුකම සමඟ, ICT විෂය සැබෑ ලෝකයේ උදාහරණ ඔස්සේ සරලව උගන්වයි.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Chip tone="blue" icon="check">{TEACHER.role}</Chip>
                <Chip tone="red" icon="check">{TEACHER.details[1]}</Chip>
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

      <footer className="bg-navy-950 py-8 text-center text-sm text-white/60">
        <p>© {new Date().getFullYear()} Innovative ICT</p>
        <p className="mt-1 text-white/40">{TEACHER.name}</p>
      </footer>
    </div>
  );
}

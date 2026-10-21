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
        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Logo tone="dark" />
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher tone="dark" />
            <Link href={home ?? "/login"} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-white hover:bg-white/10">
              {home ? "Dashboard" : "Login"}
            </Link>
          </div>
        </header>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-10">
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
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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
              <p className="mt-1 text-sm font-semibold text-accent">{t(TEACHER.title)}</p>
              <p className="mt-1 text-xs leading-snug text-muted">{t(TEACHER.details[0])}</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
        {/* Features: විවිධ ප්‍රමාණ, විවිධ වර්ණ */}
        <section className="grid gap-5 py-14 lg:grid-cols-3 lg:py-20">
          <div className="pixel-grid-soft flex flex-col justify-between rounded-[2rem] bg-primary-soft p-8 lg:row-span-2 lg:min-h-[360px]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
              <Icon name={features[0].icon} className="h-7 w-7" />
            </span>
            <div className="mt-10">
              <h2 className="text-3xl font-bold text-navy">{t(features[0].title)}</h2>
              <p className="mt-3 leading-relaxed text-navy/70">{t(features[0].text)}</p>
            </div>
          </div>
          <div className="card flex items-start gap-5 p-7 lg:col-span-2">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
              <Icon name={features[1].icon} className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-navy">{t(features[1].title)}</h2>
              <p className="mt-2 leading-relaxed text-muted">{t(features[1].text)}</p>
            </div>
          </div>
          <div className="flex items-start gap-5 rounded-[1.75rem] bg-sun-soft p-7 lg:col-span-2">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sun text-navy">
              <Icon name={features[2].icon} className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-navy">{t(features[2].title)}</h2>
              <p className="mt-2 leading-relaxed text-navy/70">{t(features[2].text)}</p>
            </div>
          </div>
        </section>

        {/* පන්ති පවත්වන ස්ථාන */}
        <section className="pb-16 lg:pb-24">
          <h2 className="text-3xl font-bold text-navy">{t("පන්ති පවත්වන ස්ථාන")}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </main>

      <footer className="bg-navy-950 py-8 text-center text-sm text-white/60">
        © {new Date().getFullYear()} Innovative ICT
      </footer>
    </div>
  );
}

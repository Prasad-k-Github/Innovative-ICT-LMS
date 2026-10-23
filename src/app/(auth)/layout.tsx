import Image from "next/image";
import Link from "next/link";
import { AuthContainer } from "@/components/auth-container";
import { Icon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/ui";
import { TEACHER } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

const STEPS = ["ලියාපදිංචි වන්න", "Email තහවුරු කරන්න", "මුරපදය සාදන්න", "Admin අනුමැතිය ලබාගන්න"];

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[5fr_7fr]">
      {/* වම: සම්පූර්ණ උස navy පැනලය (විශාල තිර පමණි) */}
      <aside className="pixel-grid relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-12 text-white lg:flex xl:p-16">
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full bg-primary/30 blur-3xl" aria-hidden="true" />
        <Logo tone="dark" />

        <div className="relative max-w-md">
          <h2 className="font-display text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">{t("ICT ඉගෙනීම, වඩා සරලව.")}</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            {t("ICT විෂය සඳහා සරල, පහසු ඉගෙනුම් පද්ධතිය. ඔබගේ ශ්‍රේණියට අදාළ සියල්ල එකම තැනකින්.")}
          </p>

          <ol className="mt-10 space-y-0">
            {STEPS.map((s, i) => (
              <li key={s} className="relative flex items-center gap-4 pb-6 last:pb-0">
                {i < STEPS.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-2rem)] w-px bg-white/20" aria-hidden="true" />}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sun/70 bg-sun/10 text-sm font-bold text-sun">{i + 1}</span>
                <span className="font-medium text-white/90">{t(s)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 pr-5">
          <Image src="/teacher.jpg" alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-cover" />
          <div className="leading-tight">
            <p className="font-semibold">{TEACHER.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-sun">
              <Icon name="check" className="h-4 w-4" />
              {TEACHER.title}
            </p>
          </div>
        </div>
      </aside>

      {/* දකුණ: පෝරමය */}
      <main className="flex min-h-dvh flex-col bg-white px-5 py-5 sm:px-10 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between">
          <div className="lg:invisible">
            <Logo />
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <AuthContainer>{children}</AuthContainer>
        </div>
        <p className="pb-1 text-center text-xs text-muted">
          © {new Date().getFullYear()} Innovative ICT ·{" "}
          <Link href="/cookies" className="inline-flex min-h-8 items-center underline underline-offset-2 hover:text-ink">
            {t("Cookies සහ session")}
          </Link>
        </p>
      </main>
    </div>
  );
}

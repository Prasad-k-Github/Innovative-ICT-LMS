import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingConsentForm, OnboardingEmailForm, OnboardingPasswordForm } from "@/components/onboarding-forms";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { ONBOARDING_ORDER } from "@/lib/onboarding";
import { requireStudentSetup } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ගිණුම සක්‍රීය කරන්න") };
}
export const dynamic = "force-dynamic";

// පළමු login පියවර: සිසුවා සිටින පියවර පමණක් පෙන්වයි; අවසන් වූ විට Dashboard වෙත යයි
export default async function WelcomePage() {
  const me = await requireStudentSetup();
  const step = me.onboardingStep;
  if (!step) redirect("/dashboard");
  const t = await getT();
  const [row] = await db.select({ parentPhone: users.parentPhone, parentEmail: users.parentEmail }).from(users).where(eq(users.id, me.id)).limit(1);
  const idx = ONBOARDING_ORDER.indexOf(step);

  const titles = {
    password: ["ඔබගේ මුරපදය සාදන්න", "Admin ලබා දුන් තාවකාලික මුරපදය වෙනුවට ඔබටම පමණක් දන්නා මුරපදයක් සාදන්න."],
    email: ["Email ලිපිනය තහවුරු කරන්න", "ඔබගේ Email ලිපිනයට යැවූ ඉලක්කම් 6ක code එක ඇතුළත් කරන්න."],
    consent: ["එකඟත්වය සහ දෙමාපිය විස්තර", "අවසන් පියවර: දෙමාපියන්ගේ සම්බන්ධතා සහ එකඟත්වයන් තහවුරු කරන්න."],
  } as const;
  const [title, sub] = titles[step];

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-primary" data-testid="onb-progress">
        {t("පියවර {n} / {total}", { n: idx + 1, total: ONBOARDING_ORDER.length })}
      </p>
      <div>
        <h1 className="text-3xl font-bold">{t(title)}</h1>
        <p className="mt-1 text-sm text-muted">{t(sub)}</p>
      </div>
      {step === "consent" && row && !row.parentPhone && (
        <Alert kind="warning">{t("දෙමාපියන්ගේ දුරකතන අංකය අනිවාර්යයි. කරුණාකර එය ඇතුළත් කරන්න.")}</Alert>
      )}
      {step === "password" && <OnboardingPasswordForm />}
      {step === "email" && <OnboardingEmailForm email={me.email} />}
      {step === "consent" && <OnboardingConsentForm initial={{ parentPhone: row?.parentPhone ?? "", parentEmail: row?.parentEmail ?? "" }} />}
    </div>
  );
}

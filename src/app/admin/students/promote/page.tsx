import type { Metadata } from "next";
import { PromoteForm } from "@/components/promote-form";
import { PageHero } from "@/components/page-hero";
import { getT } from "@/lib/i18n/server";
import { requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ශ්‍රේණි උසස් කිරීම") };
}

// වර්ෂාවසානයේ ශ්‍රේණි උසස් කිරීම: Super Admin (ගුරුවරයා) පමණි
export default async function PromoteStudentsPage() {
  await requireSuperAdmin();
  const t = await getT();
  return (
    <div className="w-full space-y-6">
      <PageHero icon="users" back={{ href: "/admin/students", label: t("සිසුන්") }} title={t("ශ්‍රේණි උසස් කිරීම")} subtitle={t("වර්ෂාවසානයේ සිසුන් ඊළඟ ශ්‍රේණියට එකවර උසස් කරන්න (11 → උසස් පෙළ).")} />
      <PromoteForm />
    </div>
  );
}

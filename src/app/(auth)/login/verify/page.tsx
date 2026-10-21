import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaLoginForm } from "@/components/mfa-forms";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, getMfaPendingUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("2-step verification") };
}
export const dynamic = "force-dynamic";

export default async function VerifyMfaPage() {
  const t = await getT();
  const user = await getCurrentUser();
  if (user) redirect(user.role === "STUDENT" ? "/dashboard" : "/admin");
  const pending = await getMfaPendingUser();
  if (!pending) redirect("/login");

  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("2-step verification")}</h1>
      <p className="mb-6 text-sm text-muted">{t("{name}, ඔබගේ ගිණුම ආරක්ෂා කිරීමට අමතර සත්‍යාපනයක් අවශ්‍යයි.", { name: pending.name })}</p>
      <MfaLoginForm />
    </>
  );
}

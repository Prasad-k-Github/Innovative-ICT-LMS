import type { Metadata } from "next";
import { createAdminAction } from "@/app/actions/super-admin";
import { AdminUserForm } from "@/components/admin-user-form";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireSuperAdmin } from "@/lib/session";
import { PageHero } from "@/components/page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් Admin කෙනෙක්") };
}

export default async function NewAdminPage() {
  await requireSuperAdmin();
  const t = await getT();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero icon="shield" back={{ href: "/admin/admins", label: t("Admin ලා") }} title={t("අලුත් Admin කෙනෙක් එක් කරන්න")} />
      <Alert kind="info">{t("Admin ට මුරපදය සකසා ගැනීමට Email ඇරයුමක් (පැය 72ක් වලංගු) යැවේ. ඔබට ඔවුන්ගේ මුරපදය නොදනී.")}</Alert>
      <div className="card p-5 sm:p-6">
        <AdminUserForm action={createAdminAction} submitLabel={t("Admin එක් කරන්න")} />
      </div>
    </div>
  );
}

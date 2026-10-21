import type { Metadata } from "next";
import Link from "next/link";
import { createAdminAction } from "@/app/actions/super-admin";
import { AdminUserForm } from "@/components/admin-user-form";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireSuperAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් Admin කෙනෙක්") };
}

export default async function NewAdminPage() {
  await requireSuperAdmin();
  const t = await getT();
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/admin/admins" className="text-sm font-semibold text-primary hover:underline">
        {t("← Admin ලා")}
      </Link>
      <h1 className="text-3xl font-bold">{t("අලුත් Admin කෙනෙක් එක් කරන්න")}</h1>
      <Alert kind="info">{t("Admin ට මුරපදය සකසා ගැනීමට Email ඇරයුමක් (පැය 72ක් වලංගු) යැවේ. ඔබට ඔවුන්ගේ මුරපදය නොදනී.")}</Alert>
      <div className="card p-5">
        <AdminUserForm action={createAdminAction} submitLabel={t("Admin එක් කරන්න")} />
      </div>
    </div>
  );
}

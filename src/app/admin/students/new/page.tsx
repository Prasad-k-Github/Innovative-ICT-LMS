import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { createStudentAction } from "@/app/actions/admin";
import { StudentForm } from "@/components/student-form";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { PageHero } from "@/components/page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් සිසුවෙක්") };
}

export default async function NewStudentPage() {
  await requireAdmin();
  const t = await getT();
  const list = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero icon="users" back={{ href: "/admin/students", label: t("සිසුන්") }} title={t("අලුත් සිසුවෙක් එක් කරන්න")} />
      <Alert kind="info">
        {t("ගිණුම සක්‍රියව සාදනු ලබන අතර, සිසුවාට මුරපදය සකසා ගැනීමට Email ඇරයුමක් (පැය 72ක් වලංගු) යැවේ.")}
      </Alert>
      <div className="card p-5 sm:p-6">
        <StudentForm action={createStudentAction} institutes={list} submitLabel={t("සිසුවා එක් කරන්න")} />
      </div>
    </div>
  );
}

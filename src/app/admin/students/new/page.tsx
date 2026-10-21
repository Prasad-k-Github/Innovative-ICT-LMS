import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { createStudentAction } from "@/app/actions/admin";
import { StudentForm } from "@/components/student-form";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් සිසුවෙක්") };
}

export default async function NewStudentPage() {
  await requireAdmin();
  const t = await getT();
  const list = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/admin/students" className="text-sm font-semibold text-primary hover:underline">
        {t("← සිසුන්")}
      </Link>
      <h1 className="text-3xl font-bold">{t("අලුත් සිසුවෙක් එක් කරන්න")}</h1>
      <Alert kind="info">
        {t("ගිණුම සක්‍රියව සාදනු ලබන අතර, සිසුවාට මුරපදය සකසා ගැනීමට Email ඇරයුමක් (පැය 72ක් වලංගු) යැවේ.")}
      </Alert>
      <div className="card p-5">
        <StudentForm action={createStudentAction} institutes={list} submitLabel={t("සිසුවා එක් කරන්න")} />
      </div>
    </div>
  );
}

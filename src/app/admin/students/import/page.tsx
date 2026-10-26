import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { StudentImportForm } from "@/components/student-import-form";
import { PageHero, heroBtnGhost } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { IMPORT_MAX_ROWS } from "@/lib/student-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // ඉහළ පේළි ගණනක් සඳහා ඉඩ (මුරපද hash කිරීම)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සිසුන් import කරන්න") };
}

export default async function ImportStudentsPage() {
  await requireAdmin();
  const t = await getT();
  const list = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));
  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="users"
        back={{ href: "/admin/students", label: t("සිසුන්") }}
        title={t("සිසුන් එකවර import කරන්න")}
        actions={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- ෆයිල් බාගැනීමකි (route handler), පිටුවක් නොවේ
          <a href="/admin/students/import/template" className={heroBtnGhost} data-testid="import-template">
            {t("නිදර්ශන CSV බාගන්න")}
          </a>
        }
      />
      <Alert kind="info">
        {t("තීරු: name, school, grade, medium (SINHALA / ENGLISH), phone, email, parent_phone (අනිවාර්ය). විකල්ප: parent_email, al_year (උසස් පෙළ සඳහා), institute (ආයතනයේ නම). ගිණුම් සක්‍රියව සාදනු ලැබේ; සෑම සිසුවෙකුටම තාවකාලික මුරපදයක් ජනනය වේ.")}
      </Alert>
      {list.length === 0 ? <Alert kind="warning">{t("පළමුව ආයතනයක් එක් කරන්න.")}</Alert> : <StudentImportForm institutes={list} maxRows={IMPORT_MAX_ROWS} />}
    </div>
  );
}

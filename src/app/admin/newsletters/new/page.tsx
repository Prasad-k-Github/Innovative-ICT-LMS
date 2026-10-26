import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { createNewsletterAction } from "@/app/actions/newsletters";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHero } from "@/components/page-hero";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් Newsletter එකක්") };
}

export default async function NewNewsletterPage() {
  await requireAdmin();
  const t = await getT();
  const inst = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));
  return (
    <div className="w-full space-y-6">
      <PageHero icon="papers" back={{ href: "/admin/newsletters", label: t("පන්ති පුවත්පත්‍රිකා") }} title={t("අලුත් Newsletter එකක්")} />
      <div className="card p-5 sm:p-6">
        <NewsletterForm action={createNewsletterAction} institutes={inst} />
      </div>
    </div>
  );
}

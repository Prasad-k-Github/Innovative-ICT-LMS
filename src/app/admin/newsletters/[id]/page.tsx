import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateNewsletterAction } from "@/app/actions/newsletters";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHero } from "@/components/page-hero";
import { db } from "@/db";
import { institutes, newsletters } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Newsletter සංස්කරණය") };
}

export default async function EditNewsletterPage(props: PageProps<"/admin/newsletters/[id]">) {
  await requireAdmin();
  const t = await getT();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const [[n], inst] = await Promise.all([
    db.select().from(newsletters).where(eq(newsletters.id, id)).limit(1),
    db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name)),
  ]);
  if (!n) notFound();
  return (
    <div className="w-full space-y-6">
      <PageHero icon="papers" back={{ href: "/admin/newsletters", label: t("පන්ති පුවත්පත්‍රිකා") }} title={t("Newsletter සංස්කරණය")} />
      <div className="card p-5 sm:p-6">
        <NewsletterForm
          action={updateNewsletterAction}
          institutes={inst}
          id={n.id}
          published={n.published}
          initial={{ title: n.title, summary: n.summary, body: n.body, grade: n.grade ? String(n.grade) : "", medium: n.medium ?? "", instituteId: n.instituteId ?? "" }}
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { UUID_RE } from "@/lib/assessment";
import { getT } from "@/lib/i18n/server";
import { newsletterFor } from "@/lib/newsletters";
import { requireStudent } from "@/lib/session";
import { formatColombo } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පන්ති පුවත්පත්‍රිකාව") };
}

export default async function StudentNewsletterPage(props: PageProps<"/dashboard/newsletter/[id]">) {
  const user = await requireStudent();
  const t = await getT();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const n = await newsletterFor(user, id);
  if (!n) notFound();
  return (
    <div className="w-full space-y-6">
      <PageHero icon="papers" back={{ href: "/dashboard/newsletter", label: t("පන්ති පුවත්පත්‍රිකාව") }} title={n.title} subtitle={n.publishedAt ? formatColombo(n.publishedAt) : undefined} />
      <article className="card max-w-3xl p-5 sm:p-7" data-testid="newsletter-body">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-ink [overflow-wrap:anywhere]">{n.body}</p>
      </article>
    </div>
  );
}

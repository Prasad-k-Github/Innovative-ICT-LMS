import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmptyState, PageHero } from "@/components/page-hero";
import { getT } from "@/lib/i18n/server";
import { newslettersFor } from "@/lib/newsletters";
import { requireStudent } from "@/lib/session";
import { formatColombo } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පන්ති පුවත්පත්‍රිකාව") };
}

export default async function StudentNewsletterListPage() {
  const user = await requireStudent();
  const t = await getT();
  const rows = await newslettersFor(user, 50);
  return (
    <div className="w-full space-y-6">
      <PageHero icon="papers" back={{ href: "/dashboard", label: t("Dashboard") }} title={t("පන්ති පුවත්පත්‍රිකාව")} />
      {rows.length === 0 ? (
        <EmptyState icon="papers">{t("තවම පුවත්පත්‍රිකා නැත.")}</EmptyState>
      ) : (
        <ul className="grid gap-3" data-testid="newsletter-archive">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/newsletter/${r.id}`} data-newsletter={r.id} className="card group flex min-h-16 items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:border-primary/50">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-navy [overflow-wrap:anywhere]">{r.title}</span>
                  {r.summary && <span className="mt-0.5 block text-sm text-muted [overflow-wrap:anywhere]">{r.summary}</span>}
                  <span className="mt-1 block text-xs text-muted">{r.publishedAt ? formatColombo(r.publishedAt) : ""}</span>
                </span>
                <Icon name="arrow" className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

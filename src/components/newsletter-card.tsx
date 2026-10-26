import Link from "next/link";
import { Icon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import { newslettersFor } from "@/lib/newsletters";
import type { SessionUser } from "@/lib/session";
import { formatColombo } from "@/lib/time";

// Dashboard: නවතම පන්ති පුවත්පත්‍රිකා 3 (පළ කළ, සිසුවාට අදාළ ඒවා පමණි)
export async function NewsletterCard({ user }: { user: SessionUser }) {
  const t = await getT();
  const rows = await newslettersFor(user, 3);
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3" data-testid="newsletter-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-navy">{t("පන්ති පුවත්පත්‍රිකාව")}</h2>
        <Link href="/dashboard/newsletter" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline" data-testid="newsletter-all">
          {t("සියල්ල බලන්න")}
        </Link>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/dashboard/newsletter/${r.id}`} data-newsletter={r.id} className="card group flex h-full min-h-28 flex-col gap-1.5 p-4 transition hover:-translate-y-0.5 hover:border-primary/50">
              <span className="flex items-center gap-2 text-xs text-muted">
                <Icon name="papers" className="h-4 w-4 text-primary" />
                {r.publishedAt ? formatColombo(r.publishedAt) : ""}
              </span>
              <span className="font-semibold text-navy [overflow-wrap:anywhere]">{r.title}</span>
              {r.summary && <span className="line-clamp-3 text-sm text-muted [overflow-wrap:anywhere]">{r.summary}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { deleteNewsletterAction, toggleNewsletterAction } from "@/app/actions/newsletters";
import { Chip, Tile, ToneCard } from "@/components/cards";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHero, heroBtnGhost } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes, newsletters } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { formatColombo } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පන්ති පුවත්පත්‍රිකා") };
}

const NOTICES: Record<string, string> = {
  saved: "Newsletter එක සුරකින ලදී.",
  published: "Newsletter එක පළ කරන ලදී. සිසුන්ට දැනුම් දෙන ලදී.",
  deleted: "Newsletter එක ඉවත් කරන ලදී.",
};

export default async function AdminNewslettersPage(props: PageProps<"/admin/newsletters">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : undefined;
  const [rows, inst] = await Promise.all([
    db.select().from(newsletters).orderBy(desc(newsletters.createdAt)).limit(100),
    db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name)),
  ]);
  const instName = new Map(inst.map((i) => [i.id, i.name]));
  const btn = "inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold";

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="papers"
        title={t("පන්ති පුවත්පත්‍රිකා")}
        subtitle={t("ලියා පළ කළ විට අදාළ සිසුන්ගේ Dashboard එකේ පෙනේ. සිසුන්ට දැනුම්දීමක් ද යයි (Email නොයයි).")}
        actions={
          <Link href="/admin/newsletters/new" className={heroBtnGhost} data-testid="newsletter-new-link">
            {t("අලුත් Newsletter එකක්")}
          </Link>
        }
      />
      {notice && <Alert kind="success">{notice}</Alert>}
      {rows.length === 0 ? (
        <EmptyState icon="papers">{t("තවම Newsletter එකක් නැත.")}</EmptyState>
      ) : (
        <ul className="grid gap-4" data-testid="newsletter-list">
          {rows.map((r) => (
            <li key={r.id} data-newsletter={r.id} data-published={r.published ? "1" : "0"}>
              <ToneCard tone={r.published ? "green" : "blue"} className="p-4 pt-5">
                <div className="flex flex-wrap items-start gap-3">
                  <Tile icon="papers" tone={r.published ? "green" : "blue"} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy [overflow-wrap:anywhere]">{r.title}</p>
                    {r.summary && <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{r.summary}</p>}
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      <Chip tone={r.published ? "green" : "sun"}>{r.published ? t("පළ කර ඇත") : t("කෙටුම්පත")}</Chip>
                      <Chip tone="blue">{r.grade ? gradeLabel(r.grade, null, t) : t("සියලු ශ්‍රේණි")}</Chip>
                      <Chip tone="violet">{r.medium ? t(MEDIUM_LABELS[r.medium]) : t("සියලු මාධ්‍ය")}</Chip>
                      <Chip tone="sun">{r.instituteId ? (instName.get(r.instituteId) ?? "-") : t("සියලු ආයතන")}</Chip>
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {r.publishedAt ? `${t("පළ කළේ")}: ${formatColombo(r.publishedAt)}` : `${t("සාදන ලද්දේ")}: ${formatColombo(r.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/newsletters/${r.id}`} className={`${btn} border-line bg-white hover:bg-slate-50`}>
                      {t("සංස්කරණය")}
                    </Link>
                    <form>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" formAction={toggleNewsletterAction} data-testid="newsletter-toggle" className={`${btn} border-line bg-white hover:bg-slate-50`}>
                        {r.published ? t("සඟවන්න") : t("පළ කරන්න")}
                      </button>
                    </form>
                    <form>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton message={t("\"{name}\" ඉවත් කරන්නද?", { name: r.title })} formAction={deleteNewsletterAction} className={`${btn} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
                        {t("ඉවත් කරන්න")}
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </ToneCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

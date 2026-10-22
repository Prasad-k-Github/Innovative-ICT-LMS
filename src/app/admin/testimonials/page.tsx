import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { createTestimonialAction, deleteTestimonialAction, reviewTestimonialAction, toggleTestimonialAction, updateTestimonialAction } from "@/app/actions/testimonials";
import { Chip, Tile, ToneCard } from "@/components/cards";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, HeroBadge, PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";
import { TestimonialForm } from "@/components/testimonial-form";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අදහස් (Testimonials)") };
}

const NOTICES: Record<string, string> = {
  created: "අදහස එක් කරන ලදී.",
  updated: "අදහස යාවත්කාලීන කරන ලදී.",
  shown: "අදහස landing page එකේ පෙන්වයි.",
  hidden: "අදහස landing page එකෙන් සැඟවුවා.",
  deleted: "අදහස ඉවත් කරන ලදී.",
  approved: "අදහස අනුමත කරන ලදී. දැන් Landing page එකේ පෙනේ.",
  rejected: "අදහස ප්‍රතික්ෂේප කරන ලදී.",
};

export default async function AdminTestimonialsPage(props: PageProps<"/admin/testimonials">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : undefined;
  const rows = await db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(200);
  const pending = rows.filter((r) => r.status === "PENDING");
  const others = rows.filter((r) => r.status !== "PENDING");
  const shown = others.filter((r) => r.published).length;

  const tab = pickTab(sp.tab, ["list", "pending", "add"]);
  const tabs = [
    { key: "list", label: t("අදහස්"), href: tabHref("/admin/testimonials", "list", true), count: others.length },
    { key: "pending", label: t("සිසුන් එවූ (අනුමැතියට)"), href: tabHref("/admin/testimonials", "pending", false), count: pending.length },
    { key: "add", label: t("අලුත් අදහසක්"), href: tabHref("/admin/testimonials", "add", false) },
  ];

  const view = tab === "pending" ? pending : others;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="quote"
        title={t("අදහස් (Testimonials)")}
        subtitle={t("සිසුන්/දෙමාපියන්ගේ සැබෑ අදහස් එක් කර Landing page එකේ පෙන්වන්න. පෙන්වීම/සැඟවීම ඔබට පාලනය කළ හැක.")}
        badges={<HeroBadge tone="sun">{t("පෙන්වන ඒවා {n}", { n: shown })}</HeroBadge>}
      />
      {notice && <Alert kind="success">{notice}</Alert>}
      <PageTabs tabs={tabs} active={tab} label={t("අදහස් කොටස්")} />

      {tab === "add" && (
        <section className="card p-5 sm:p-6">
          <TestimonialForm action={createTestimonialAction} submitLabel={t("අදහස එක් කරන්න")} />
        </section>
      )}

      {(tab === "list" || tab === "pending") &&
        (view.length === 0 ? (
          <EmptyState icon="quote">{tab === "pending" ? t("අනුමැතිය බලාපොරොත්තුවෙන් සිසුන් එවූ අදහස් නැත.") : t("තවම අදහස් එක් කර නැත. \"අලුත් අදහසක්\" ටැබයෙන් එක් කරන්න.")}</EmptyState>
        ) : (
          <ul className="grid gap-4" data-testid="testimonial-list">
            {view.map((r) => (
              <li key={r.id} data-testimonial={r.id} data-published={r.published ? "1" : "0"}>
                <ToneCard tone={r.published ? "green" : "blue"} className="p-4 pt-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <Tile icon="quote" tone={r.published ? "green" : "blue"} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy [overflow-wrap:anywhere]">{r.authorName}</p>
                      {r.authorInfo && <p className="text-sm text-muted [overflow-wrap:anywhere]">{r.authorInfo}</p>}
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{r.quote}</p>
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {r.status === "PENDING" ? (
                          <Chip tone="sun">{t("අනුමැතිය බලාපොරොත්තුවෙන්")}</Chip>
                        ) : (
                          <Chip tone={r.published ? "green" : "sun"}>{r.published ? t("Landing page එකේ පෙනේ") : r.status === "REJECTED" ? t("ප්‍රතික්ෂේප කළා") : t("සැඟවී ඇත")}</Chip>
                        )}
                        {r.submittedBy && <Chip tone="violet">{t("සිසුවා එවූ")}</Chip>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "PENDING" || r.status === "REJECTED" ? (
                        <form action={reviewTestimonialAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" name="decision" value="approve" className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700" data-testid="approve-testimonial">
                            {t("අනුමත කරන්න")}
                          </button>
                          {r.status === "PENDING" && (
                            <button type="submit" name="decision" value="reject" className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy hover:bg-primary-soft" data-testid="reject-testimonial">
                              {t("ප්‍රතික්ෂේප කරන්න")}
                            </button>
                          )}
                        </form>
                      ) : (
                        <form action={toggleTestimonialAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="show" value={r.published ? "0" : "1"} />
                          <button type="submit" className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy hover:bg-primary-soft" data-testid="toggle-testimonial">
                            {r.published ? t("සඟවන්න") : t("පෙන්වන්න")}
                          </button>
                        </form>
                      )}
                      <form>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton
                          message={t("\"{name}\" ඉවත් කරන්නද?", { name: r.authorName })}
                          formAction={deleteTestimonialAction}
                          className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          {t("ඉවත් කරන්න")}
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary" data-testid="edit-testimonial">
                      {t("වෙනස් කරන්න")}
                    </summary>
                    <div className="pt-3">
                      <TestimonialForm
                        action={updateTestimonialAction}
                        submitLabel={t("වෙනස්කම් සුරකින්න")}
                        initial={{ id: r.id, authorName: r.authorName, authorInfo: r.authorInfo, quote: r.quote, published: r.published, pending: r.status === "PENDING" }}
                      />
                    </div>
                  </details>
                </ToneCard>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

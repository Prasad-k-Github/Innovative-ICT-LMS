import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { createClassLinkAction, deleteClassLinkAction } from "@/app/actions/class-links";
import { ClassLinkForm } from "@/components/assessment-forms";
import { Chip, Tile, ToneCard } from "@/components/cards";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { classLinks, institutes } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { formatColombo, nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Online පන්ති") };
}

const NOTICES: Record<string, string> = { created: "Zoom link එක එක් කරන ලදී. සිසුන්ට පැය 24ක් පෙනේ.", deleted: "Zoom link එක ඉවත් කරන ලදී." };

export default async function AdminClassesPage(props: PageProps<"/admin/classes">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : undefined;
  const [rows, inst] = await Promise.all([
    db.select().from(classLinks).orderBy(desc(classLinks.createdAt)).limit(100),
    db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name)),
  ]);
  const instName = new Map(inst.map((i) => [i.id, i.name]));
  const now = nowMs();
  const active = rows.filter((r) => r.expiresAt.getTime() > now);

  const tab = pickTab(sp.tab, ["list", "add"]);
  const tabs = [
    { key: "list", label: t("Zoom links"), href: tabHref("/admin/classes", "list", true), count: active.length },
    { key: "add", label: t("අලුත් link එකක්"), href: tabHref("/admin/classes", "add", false) },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero icon="play" title={t("Online පන්ති")} subtitle={t("Zoom link එකක් එක් කළ විට අදාළ ශ්‍රේණියේ සිසුන්ට Dashboard එකේ පැය 24ක් පෙන්වයි. ඉන් පසු ස්වයංක්‍රීයව සැඟවේ.")} />
      {notice && <Alert kind="success">{notice}</Alert>}
      <PageTabs tabs={tabs} active={tab} label={t("Online පන්ති කොටස්")} />

      {tab === "add" && (
        <section className="card p-5 sm:p-6">
          <ClassLinkForm action={createClassLinkAction} institutes={inst} submitLabel={t("Zoom link එක එක් කරන්න")} />
        </section>
      )}

      {tab === "list" &&
        (rows.length === 0 ? (
          <EmptyState icon="play">{t("තවම Zoom links එක් කර නැත.")}</EmptyState>
        ) : (
          <ul className="grid gap-4" data-testid="class-list">
            {rows.map((r) => {
              const left = r.expiresAt.getTime() - now;
              const live = left > 0;
              return (
                <li key={r.id} data-class={r.id} data-live={live ? "1" : "0"}>
                  <ToneCard tone={live ? "red" : "blue"} className="p-4 pt-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <Tile icon="play" tone={live ? "red" : "blue"} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy [overflow-wrap:anywhere]">{r.title}</p>
                        <p className="mt-1.5 flex flex-wrap gap-1.5">
                          <Chip tone="blue">{gradeLabel(r.grade, null, t)}</Chip>
                          <Chip tone="violet">{t(MEDIUM_LABELS[r.medium])}</Chip>
                          <Chip tone="sun">{r.instituteId ? (instName.get(r.instituteId) ?? "-") : t("සියලු ආයතන")}</Chip>
                          {live ? (
                            <Chip tone="green">{t("සිසුන්ට පෙනේ · පැය {n}ක් ඉතිරියි", { n: Math.max(1, Math.ceil(left / 3_600_000)) })}</Chip>
                          ) : (
                            <Chip tone="red">{t("කල් ඉකුත් විය (සිසුන්ට නොපෙනේ)")}</Chip>
                          )}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          {t("එක් කළේ")}: {formatColombo(r.createdAt)} · {t("සැඟවෙන්නේ")}: {formatColombo(r.expiresAt)}
                        </p>
                        <p className="mt-1 break-all text-xs text-primary">{r.url}</p>
                      </div>
                      <form>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton
                          message={t("\"{name}\" ඉවත් කරන්නද?", { name: r.title })}
                          formAction={deleteClassLinkAction}
                          className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          {t("ඉවත් කරන්න")}
                        </ConfirmButton>
                      </form>
                    </div>
                  </ToneCard>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

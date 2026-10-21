import type { Metadata } from "next";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { createResourceAction, deleteResourceAction, toggleResourceAction, updateResourceAction } from "@/app/actions/content";
import { ConfirmButton } from "@/components/confirm-button";
import { ResourceForm } from "@/components/content-forms";
import { ScopeFilter } from "@/components/scope-filter";
import { ToneCard } from "@/components/cards";
import { RESOURCE_COLOR, RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { CONTENT_TYPE_LABELS, GENERAL_TYPES, MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { parseScope } from "@/lib/content-scope";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { EmptyState, PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Papers සහ වෙනත්") };
}

const NOTICES: Record<string, string> = {
  "r-published": "Link එක සිසුන්ට පෙනෙන ලෙස සකසන ලදී.",
  "r-hidden": "Link එක සිසුන්ගෙන් සඟවන ලදී.",
  "r-deleted": "Link එක මකා දමන ලදී.",
};

export default async function PapersPage(props: PageProps<"/admin/papers">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const { grade, medium } = parseScope(sp);
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : "";

  const files = await db
    .select()
    .from(resources)
    .where(and(eq(resources.grade, grade), eq(resources.medium, medium), isNull(resources.lessonId), inArray(resources.type, GENERAL_TYPES)))
    .orderBy(resources.type, desc(resources.year), desc(resources.createdAt));

  const btn = "min-h-10 rounded-xl px-3 text-sm font-semibold transition";

  const tab = pickTab(sp.tab, ["list", "add"]);
  const tabs = [
    { key: "list", label: t("Links"), href: tabHref(`/admin/papers?grade=${grade}&medium=${medium}`, "list", true), count: files.length },
    { key: "add", label: t("අලුත් link එකක්"), href: tabHref(`/admin/papers?grade=${grade}&medium=${medium}`, "add", false) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero icon="papers" title={t("Papers සහ වෙනත්")} subtitle={t("පාඩමකට සම්බන්ධ නොවන Past Papers, Model Papers, Recordings සහ අමතර Notes මෙතැනින් එක් කරන්න.")} />
      <ScopeFilter grade={grade} medium={medium} action="/admin/papers" t={t} />
      {notice && <Alert kind="success">{notice}</Alert>}

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "list" && (
        <h2 className="font-display text-xl font-bold text-navy">
          {gradeLabel(grade, null, t)} · {t(MEDIUM_LABELS[medium])}
        </h2>

      )}
      {tab === "list" && (
        files.length === 0 ? (
          <EmptyState>{t("තවම links නැත.")}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {files.map((f) => (
              <li key={f.id}>
              <ToneCard tone={RESOURCE_COLOR[f.type]} className="space-y-2 p-4 pt-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RESOURCE_TONE[f.type].chip}`}><span aria-hidden="true">{RESOURCE_ICON[f.type]}</span>{t(CONTENT_TYPE_LABELS[f.type])}</span>
                  <span className="font-medium">{f.title || t(CONTENT_TYPE_LABELS[f.type])}</span>
                  {f.year && <span className="text-muted">{f.year}</span>}
                  {!f.isPublished && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs text-muted">{t("සඟවා ඇත")}</span>}
                </div>
                <a href={f.driveUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-primary hover:underline">
                  {f.driveUrl}
                </a>
                <form className="flex flex-wrap gap-2">
                  <button type="submit" formAction={toggleResourceAction.bind(null, f.id)} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                    {f.isPublished ? t("සඟවන්න") : t("පෙන්වන්න")}
                  </button>
                  <ConfirmButton
                    message={t("මෙම link එක මකා දමන්නද?")}
                    formAction={deleteResourceAction.bind(null, f.id)}
                    className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                  >
                    {t("මකන්න")}
                  </ConfirmButton>
                </form>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-primary">{t("සංස්කරණය")}</summary>
                  <div className="mt-3">
                    <ResourceForm
                      action={updateResourceAction}
                      types={GENERAL_TYPES}
                      id={f.id}
                      prefix={`e-${f.id}`}
                      submitLabel={t("සුරකින්න")}
                      initial={{ type: f.type, title: f.title, driveUrl: f.driveUrl, year: f.year ? String(f.year) : "" }}
                    />
                  </div>
                </details>
              </ToneCard>
              </li>
            ))}
          </ul>
        )
      )}
      {tab === "add" && (
        <section className="space-y-4 card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t("අලුත් link එකක් එක් කරන්න")}</h2>
          <ResourceForm action={createResourceAction} types={GENERAL_TYPES} grade={grade} medium={medium} prefix="new" submitLabel={t("Link එක එක් කරන්න")} />
        </section>
      )}
    </div>
  );
}

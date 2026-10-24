import type { Metadata } from "next";
import { asc, eq, and, count } from "drizzle-orm";
import { createLessonAction } from "@/app/actions/content";
import { LessonCreateForm } from "@/components/content-forms";
import { ScopeFilter } from "@/components/scope-filter";
import { Chip, Tile, ToneCard, toneAt } from "@/components/cards";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { parseScope } from "@/lib/content-scope";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { EmptyState, PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tutes") };
}

export default async function TutesPage(props: PageProps<"/admin/tutes">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const { grade, medium } = parseScope(sp);
  const notice = sp.notice === "deleted" ? t("Tute එක මකා දමන ලදී.") : "";

  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      order: lessons.order,
      isPublished: lessons.isPublished,
      files: count(resources.id),
    })
    .from(lessons)
    .leftJoin(resources, eq(resources.lessonId, lessons.id))
    .where(and(eq(lessons.grade, grade), eq(lessons.medium, medium), eq(lessons.kind, "TUTE")))
    .groupBy(lessons.id)
    .orderBy(asc(lessons.order), asc(lessons.title));

  const tab = pickTab(sp.tab, ["list", "add"]);
  const tabs = [
    { key: "list", label: t("Tutes"), href: tabHref(`/admin/tutes?grade=${grade}&medium=${medium}`, "list", true), count: rows.length },
    { key: "add", label: t("අලුත් Tute එකක්"), href: tabHref(`/admin/tutes?grade=${grade}&medium=${medium}`, "add", false) },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero icon="layers" title={t("Tutes")} subtitle={t("ශ්‍රේණිය සහ මාධ්‍යය තෝරා, Tute එකකට Model Papers, Past Papers, Recordings සහ අමතර Notes Google Drive links එක් කරන්න.")} />
      <ScopeFilter grade={grade} medium={medium} action="/admin/tutes" t={t} />
      {notice && <Alert kind="success">{notice}</Alert>}

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "list" && (
        <h2 className="font-display text-xl font-bold text-navy">
          {gradeLabel(grade, null, t)} · {t(MEDIUM_LABELS[medium])} <span className="text-sm font-normal text-muted">({t("Tutes {n}", { n: rows.length })})</span>
        </h2>

      )}
      {tab === "list" && (
        rows.length === 0 ? (
          <EmptyState>{t("Tutes නැත.")}</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((l) => (
              <li key={l.id}>
                <ToneCard tone={l.isPublished ? toneAt(l.order) : "red"} href={`/admin/tutes/${l.id}`} className="flex items-center gap-3 p-4 pt-5">
                  <Tile icon="layers" tone={l.isPublished ? toneAt(l.order) : "red"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-primary">{t("Tute {n}", { n: l.order })}</span>
                    <span className="block font-semibold leading-snug text-navy">{l.title}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <Chip tone="cyan" icon="layers">{t("Links {n}", { n: l.files })}</Chip>
                      {!l.isPublished && <Chip tone="red">{t("සඟවා ඇත")}</Chip>}
                    </span>
                  </span>
                  <Icon name="arrow" className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
                </ToneCard>
              </li>
            ))}
          </ul>
        )
      )}
      {tab === "add" && (
        <section className="space-y-3 card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t("අලුත් Tute එකක් එක් කරන්න")}</h2>
          <LessonCreateForm action={createLessonAction} grade={grade} medium={medium} tute />
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { FileCard } from "@/components/file-card";
import { Icon } from "@/components/icons";
import { EmptyState, HeroBadge, PageHero } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { CONTENT_TYPE_LABELS, MEDIUM_LABELS, gradeLabel, resourceTypeFromSlug } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/dashboard/resources/[type]">): Promise<Metadata> {
  const t = await getT();
  const type = resourceTypeFromSlug((await props.params).type);
  return { title: type ? t(CONTENT_TYPE_LABELS[type]) : "" };
}

// සිසුවාගේ ශ්‍රේණියට පොදු Past Papers / Model Papers / Recordings / Notes (පැති මෙනුවෙන් ළඟා විය හැක)
export default async function ResourceTypePage(props: PageProps<"/dashboard/resources/[type]">) {
  const user = await requireStudent();
  const t = await getT();
  const type = resourceTypeFromSlug((await props.params).type);
  if (!type) notFound();
  const medium = user.medium;

  const [general, linked] = medium
    ? await Promise.all([
        db
          .select()
          .from(resources)
          .where(and(eq(resources.grade, user.grade), eq(resources.medium, medium), eq(resources.isPublished, true), isNull(resources.lessonId), eq(resources.type, type)))
          .orderBy(desc(resources.year), asc(resources.createdAt)),
        // පාඩමකට සම්බන්ධ එම වර්ගයේම අන්තර්ගතය (පාඩම අනුව)
        db
          .select({ lessonId: resources.lessonId, order: lessons.order, title: lessons.title })
          .from(resources)
          .innerJoin(lessons, eq(lessons.id, resources.lessonId))
          .where(
            and(
              eq(resources.grade, user.grade),
              eq(resources.medium, medium),
              eq(resources.isPublished, true),
              eq(lessons.isPublished, true),
              eq(lessons.kind, "LESSON"),
              isNotNull(resources.lessonId),
              eq(resources.type, type),
            ),
          )
          .orderBy(asc(lessons.order)),
      ])
    : [[], []];

  const byLesson = new Map<string, { id: string; order: number; title: string; n: number }>();
  for (const r of linked) {
    if (!r.lessonId) continue;
    const cur = byLesson.get(r.lessonId);
    if (cur) cur.n += 1;
    else byLesson.set(r.lessonId, { id: r.lessonId, order: r.order, title: r.title, n: 1 });
  }
  const lessonList = [...byLesson.values()];
  const tone = RESOURCE_TONE[type];
  const total = general.length + linked.length;

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="papers"
        back={{ href: "/dashboard", label: t("Dashboard") }}
        title={
          <>
            <span aria-hidden="true">{RESOURCE_ICON[type]}</span> {t(CONTENT_TYPE_LABELS[type])}
          </>
        }
        badges={
          <>
            <HeroBadge tone="sun">{gradeLabel(user.grade, user.alYear, t)}</HeroBadge>
            {medium && <HeroBadge>{t(MEDIUM_LABELS[medium])}</HeroBadge>}
            <HeroBadge>{total}</HeroBadge>
          </>
        }
      />

      {!medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}

      {total === 0 && medium && <EmptyState icon="papers">{t("මෙම කොටසට අන්තර්ගතය ඉක්මනින් එක් කෙරේ.")}</EmptyState>}

      {general.length > 0 && (
        <section data-section="GENERAL" className="card p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {general.map((f) => (
              <FileCard key={f.id} f={f} type={type} t={t} />
            ))}
          </div>
        </section>
      )}

      {lessonList.length > 0 && (
        <section data-section="BY_LESSON" className="space-y-3">
          <h2 className="font-display text-xl font-bold text-navy">{t("පාඩම් අනුව")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {lessonList.map((l) => (
              <Link
                key={l.id}
                href={`/dashboard/lessons/${l.id}#sec-${type}`}
                className="card group flex items-center gap-3.5 p-3.5 transition hover:-translate-y-0.5 hover:border-primary/50"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold ${tone.tile}`}>{l.order}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-navy">{l.title}</span>
                  <span className="text-xs text-muted">
                    {t(CONTENT_TYPE_LABELS[type])} · {l.n}
                  </span>
                </span>
                <Icon name="arrow" className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

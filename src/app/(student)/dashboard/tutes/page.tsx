import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { FileCard } from "@/components/file-card";
import { TuteCards } from "@/components/tute-cards";
import { GradeTabs, pickGrade } from "@/components/grade-tabs";
import { EmptyState, HeroBadge, PageHero } from "@/components/page-hero";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { MEDIUM_LABELS, gradeGroup, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tutes") };
}

// සිසුවාගේ ශ්‍රේණියට සහ මාධ්‍යයට අදාළ, සිසුන්ට පෙනෙන Tutes
export default async function StudentTutesPage(props: PageProps<"/dashboard/tutes">) {
  const user = await requireStudent();
  const t = await getT();
  const medium = user.medium;
  const allTutes = medium
    ? await db
        .select({ id: lessons.id, title: lessons.title, order: lessons.order, grade: lessons.grade })
        .from(lessons)
        .where(and(inArray(lessons.grade, gradeGroup(user.grade)), eq(lessons.medium, medium), eq(lessons.kind, "TUTE"), eq(lessons.isPublished, true)))
        .orderBy(asc(lessons.grade), asc(lessons.order), asc(lessons.title))
    : [];
  // පාඩමකට සම්බන්ධ කර ඇති Tute files (වර්ගය TUTE), පාඩම අනුව
  const lessonTuteFiles = medium
    ? await db
        .select({ f: resources, lessonTitle: lessons.title, lessonOrder: lessons.order, lessonGrade: lessons.grade })
        .from(resources)
        .innerJoin(lessons, eq(lessons.id, resources.lessonId))
        .where(
          and(
            eq(resources.type, "TUTE"),
            eq(resources.isPublished, true),
            eq(lessons.isPublished, true),
            eq(lessons.kind, "LESSON"),
            eq(lessons.medium, medium),
            inArray(lessons.grade, gradeGroup(user.grade)),
          ),
        )
        .orderBy(asc(lessons.grade), asc(lessons.order), asc(lessons.title), desc(resources.year), asc(resources.createdAt))
    : [];
  const group = gradeGroup(user.grade);
  const shared = group.length > 1;
  const picked = pickGrade((await props.searchParams).g, group, user.grade);
  const gradeCounts: Record<number, number> = {};
  for (const x of allTutes) gradeCounts[x.grade] = (gradeCounts[x.grade] ?? 0) + 1;
  for (const x of lessonTuteFiles) gradeCounts[x.lessonGrade] = (gradeCounts[x.lessonGrade] ?? 0) + 1;
  const tutes = picked === null ? allTutes : allTutes.filter((x) => x.grade === picked);
  const byLesson = new Map<string, { id: string; title: string; order: number; grade: number; files: (typeof lessonTuteFiles)[number]["f"][] }>();
  for (const x of lessonTuteFiles) {
    if (picked !== null && x.lessonGrade !== picked) continue;
    const cur = byLesson.get(x.f.lessonId!);
    if (cur) cur.files.push(x.f);
    else byLesson.set(x.f.lessonId!, { id: x.f.lessonId!, title: x.lessonTitle, order: x.lessonOrder, grade: x.lessonGrade, files: [x.f] });
  }
  const lessonGroups = [...byLesson.values()];
  const total = tutes.length + lessonGroups.reduce((n, l) => n + l.files.length, 0);
  const files = tutes.length
    ? await db
        .select({ lessonId: resources.lessonId, type: resources.type })
        .from(resources)
        .where(and(inArray(resources.lessonId, tutes.map((x) => x.id)), eq(resources.isPublished, true)))
    : [];

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="layers"
        back={{ href: "/dashboard", label: t("Dashboard") }}
        title={t("Tutes")}
        badges={
          <>
            <HeroBadge tone="sun">{gradeLabel(user.grade, user.alYear, t)}</HeroBadge>
            {medium && <HeroBadge>{t(MEDIUM_LABELS[medium])}</HeroBadge>}
            <HeroBadge>{total}</HeroBadge>
          </>
        }
      />
      <GradeTabs group={group} current={picked} own={user.grade} counts={gradeCounts} basePath="/dashboard/tutes" t={t} />
      {!medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {medium && total === 0 && <EmptyState icon="papers">{t("Tutes ඉක්මනින් එක් කෙරේ.")}</EmptyState>}
      {tutes.length > 0 && (
        <TuteCards
          tutes={tutes}
          files={files}
          t={t}
          heading="h2"
          gradeTags={gradeGroup(user.grade).length > 1 ? Object.fromEntries(tutes.map((x) => [x.id, gradeLabel(x.grade, null, t)])) : undefined}
        />
      )}
      {lessonGroups.length > 0 && (
        <section data-testid="lesson-tutes" className="space-y-6">
          {tutes.length > 0 && <h2 className="font-display text-xl font-bold text-navy">{t("පාඩම් අනුව Tutes")}</h2>}
          {lessonGroups.map((l) => (
            <div key={l.id} data-lesson-tutes={l.id} className="space-y-3">
              <Link href={`/dashboard/lessons/${l.id}`} className="inline-flex min-h-11 flex-wrap items-center gap-x-2 text-base font-bold text-navy hover:text-primary">
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                  {shared ? `${gradeLabel(l.grade, null, t)} · ` : ""}
                  {t("පාඩම {n}", { n: l.order })}
                </span>
                <span>{l.title}</span>
              </Link>
              <div className="grid gap-3 sm:grid-cols-2">
                {l.files.map((f) => (
                  <FileCard key={f.id} f={f} type="TUTE" t={t} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

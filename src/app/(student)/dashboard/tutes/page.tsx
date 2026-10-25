import type { Metadata } from "next";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TuteCards } from "@/components/tute-cards";
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
export default async function StudentTutesPage() {
  const user = await requireStudent();
  const t = await getT();
  const medium = user.medium;
  const tutes = medium
    ? await db
        .select({ id: lessons.id, title: lessons.title, order: lessons.order, grade: lessons.grade })
        .from(lessons)
        .where(and(inArray(lessons.grade, gradeGroup(user.grade)), eq(lessons.medium, medium), eq(lessons.kind, "TUTE"), eq(lessons.isPublished, true)))
        .orderBy(asc(lessons.grade), asc(lessons.order), asc(lessons.title))
    : [];
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
            <HeroBadge>{tutes.length}</HeroBadge>
          </>
        }
      />
      {!medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {medium && tutes.length === 0 && <EmptyState icon="papers">{t("Tutes ඉක්මනින් එක් කෙරේ.")}</EmptyState>}
      {tutes.length > 0 && (
        <TuteCards
          tutes={tutes}
          files={files}
          t={t}
          heading="h2"
          gradeTags={gradeGroup(user.grade).length > 1 ? Object.fromEntries(tutes.map((x) => [x.id, gradeLabel(x.grade, null, t)])) : undefined}
        />
      )}
    </div>
  );
}

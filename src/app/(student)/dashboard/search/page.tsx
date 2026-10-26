import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { Icon } from "@/components/icons";
import { EmptyState, HeroBadge, PageHero } from "@/components/page-hero";
import { Alert, inputClass } from "@/components/ui";
import { db } from "@/db";
import { assignments, lessons, quizzes, resources } from "@/db/schema";
import { eligibleFor } from "@/lib/assessment";
import { CONTENT_TYPE_LABELS, RESOURCE_SLUG, gradeGroup, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සෙවීම") };
}

// LIKE විශේෂ අකුරු (% _ \) සාමාන්‍ය අකුරු ලෙස සලකයි
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// සිසුවාට පෙනෙන පාඩම්, Tutes, Papers/Notes, Quiz සහ පැවරුම් එකවර සෙවීම
export default async function StudentSearchPage(props: PageProps<"/dashboard/search">) {
  const user = await requireStudent();
  const t = await getT();
  const raw = (await props.searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 60) ?? "";
  const medium = user.medium;
  const group = gradeGroup(user.grade);
  const shared = group.length > 1;
  const like = `%${escapeLike(q)}%`;
  const ready = q.length >= 2 && !!medium;

  const [lessonRows, fileRows, quizRows, asgRows] = ready
    ? await Promise.all([
        db
          .select({ id: lessons.id, title: lessons.title, order: lessons.order, grade: lessons.grade, kind: lessons.kind })
          .from(lessons)
          .where(and(ilike(lessons.title, like), inArray(lessons.grade, group), eq(lessons.medium, medium), eq(lessons.isPublished, true)))
          .orderBy(asc(lessons.grade), asc(lessons.order))
          .limit(20),
        db
          .select({ id: resources.id, title: resources.title, type: resources.type, grade: resources.grade, lessonId: resources.lessonId, lessonKind: lessons.kind })
          .from(resources)
          .leftJoin(lessons, eq(lessons.id, resources.lessonId))
          .where(and(ilike(resources.title, like), inArray(resources.grade, group), eq(resources.medium, medium), eq(resources.isPublished, true)))
          .orderBy(desc(resources.createdAt))
          .limit(30),
        db.select({ id: quizzes.id, title: quizzes.title, grade: quizzes.grade }).from(quizzes).where(and(ilike(quizzes.title, like), eligibleFor(user, quizzes))).orderBy(desc(quizzes.opensAt)).limit(10),
        db.select({ id: assignments.id, title: assignments.title, grade: assignments.grade }).from(assignments).where(and(ilike(assignments.title, like), eligibleFor(user, assignments))).orderBy(desc(assignments.dueAt)).limit(10),
      ])
    : [[], [], [], []];

  const tag = (g: number) => (shared ? `${gradeLabel(g, null, t)} · ` : "");
  const items: { key: string; href: string; title: string; sub: string; icon: "book" | "layers" | "papers" | "quiz" | "clipboard" }[] = [
    ...lessonRows.map((l) => ({
      key: `l${l.id}`,
      href: l.kind === "TUTE" ? `/dashboard/tutes/${l.id}` : `/dashboard/lessons/${l.id}`,
      title: l.title,
      sub: `${tag(l.grade)}${l.kind === "TUTE" ? t("Tutes") : t("පාඩම {n}", { n: l.order })}`,
      icon: l.kind === "TUTE" ? ("layers" as const) : ("book" as const),
    })),
    ...fileRows.map((f) => ({
      key: `f${f.id}`,
      href: f.lessonId ? (f.lessonKind === "TUTE" ? `/dashboard/tutes/${f.lessonId}` : `/dashboard/lessons/${f.lessonId}`) : `/dashboard/resources/${RESOURCE_SLUG[f.type] ?? "past-papers"}`,
      title: f.title || t(CONTENT_TYPE_LABELS[f.type]),
      sub: `${tag(f.grade)}${t(CONTENT_TYPE_LABELS[f.type])}`,
      icon: "papers" as const,
    })),
    ...quizRows.map((x) => ({ key: `q${x.id}`, href: `/dashboard/quizzes/${x.id}`, title: x.title, sub: `${tag(x.grade)}Quiz`, icon: "quiz" as const })),
    ...asgRows.map((x) => ({ key: `a${x.id}`, href: `/dashboard/assignments/${x.id}`, title: x.title, sub: `${tag(x.grade)}${t("පැවරුම්")}`, icon: "clipboard" as const })),
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="papers"
        back={{ href: "/dashboard", label: t("Dashboard") }}
        title={t("සෙවීම")}
        badges={q.length >= 2 ? <HeroBadge tone="sun">{items.length}</HeroBadge> : undefined}
      />
      <form method="get" action="/dashboard/search" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={60}
          autoComplete="off"
          aria-label={t("පාඩම්, Tutes, Papers, Quiz සොයන්න")}
          placeholder={t("පාඩම්, Tutes, Papers, Quiz සොයන්න")}
          className={`${inputClass} flex-1`}
        />
        <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
          <Icon name="search" className="h-5 w-5" />
          {t("සොයන්න")}
        </button>
      </form>
      {!medium && <Alert kind="warning">{t("ඔබගේ මාධ්‍යය තෝරා නැත.")}</Alert>}
      {q.length > 0 && q.length < 2 && <Alert kind="info">{t("අකුරු 2ක් හෝ වැඩි ගණනක් ටයිප් කරන්න.")}</Alert>}
      {ready && items.length === 0 && <EmptyState icon="papers">{t("ප්‍රතිඵල නැත.")}</EmptyState>}
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="search-results">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="card group flex min-h-16 items-center gap-3.5 p-3.5 transition hover:-translate-y-0.5 hover:border-primary/50">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon name={i.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-navy">{i.title}</span>
                  <span className="text-xs text-muted">{i.sub}</span>
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

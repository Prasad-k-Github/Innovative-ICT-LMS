import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { FileCard } from "@/components/file-card";
import { Icon } from "@/components/icons";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { CONTENT_TYPE_LABELS, LESSON_PAGE_ORDER, MEDIUM_LABELS, gradeGroup, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පාඩම") };
}

export default async function StudentLessonPage(props: PageProps<"/dashboard/lessons/[id]">) {
  const user = await requireStudent();
  const t = await getT();
  const { id } = await props.params;
  if (!UUID_RE.test(id) || !user.medium) notFound();

  // සිසුවාගේ ශ්‍රේණියට සහ මාධ්‍යයට අයත්, සිසුන්ට පෙනෙන පාඩම් පමණි
  const siblings = await db
    .select({ id: lessons.id, title: lessons.title, order: lessons.order, grade: lessons.grade })
    .from(lessons)
    .where(and(inArray(lessons.grade, gradeGroup(user.grade)), eq(lessons.medium, user.medium), eq(lessons.kind, "LESSON"), eq(lessons.isPublished, true)))
    .orderBy(asc(lessons.grade), asc(lessons.order), asc(lessons.title));
  const idx = siblings.findIndex((l) => l.id === id);
  if (idx < 0) notFound();
  const lesson = siblings[idx];
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  const files = await db
    .select()
    .from(resources)
    .where(and(eq(resources.lessonId, id), eq(resources.isPublished, true)))
    .orderBy(desc(resources.year), asc(resources.createdAt));

  const sections = LESSON_PAGE_ORDER.map((type) => ({ type, items: files.filter((f) => f.type === type) })).filter((s) => s.items.length);
  const total = files.length;

  return (
    <div className="space-y-8">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <span aria-hidden="true">←</span> {t("සියලු පාඩම්")}
      </Link>

      {/* පාඩම් පුවරුව */}
      <section className="pixel-grid relative overflow-hidden rounded-[1.75rem] bg-navy-950 p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
        <span
          className="pointer-events-none absolute -bottom-10 right-4 select-none font-display text-[10rem] font-extrabold leading-none text-white/[0.06] sm:text-[14rem]"
          aria-hidden="true"
        >
          {lesson.order}
        </span>
        <div className="relative max-w-2xl">
          <p className="flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-full bg-sun px-3 py-1 text-navy">{t("පාඩම {n}", { n: lesson.order })}</span>
            <span className="rounded-full bg-white/10 px-3 py-1">{gradeLabel(lesson.grade, user.alYear, t)}</span>
            <span className="rounded-full bg-white/10 px-3 py-1">{t(MEDIUM_LABELS[user.medium])}</span>
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">{lesson.title}</h1>

          {sections.length > 0 && (
            <nav aria-label={t("පාඩමේ කොටස්")} className="mt-6 flex flex-wrap gap-2">
              {sections.map((s) => (
                <a
                  key={s.type}
                  href={`#sec-${s.type}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3.5 text-sm font-semibold ring-1 ring-white/10 transition hover:bg-white/20"
                >
                  <span aria-hidden="true">{RESOURCE_ICON[s.type]}</span>
                  {t(CONTENT_TYPE_LABELS[s.type])}
                  <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-navy">{s.items.length}</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      {total === 0 && (
        <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted" data-testid="lesson-empty">
          {t("මෙම පාඩම සඳහා අන්තර්ගතය ඉක්මනින් එක් කෙරේ.")}
        </p>
      )}

      {sections.map((s) => {
        const tone = RESOURCE_TONE[s.type];
        return (
          <section key={s.type} id={`sec-${s.type}`} data-section={s.type} className="card scroll-mt-24 p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${tone.tile}`} aria-hidden="true">
                {RESOURCE_ICON[s.type]}
              </span>
              <h2 className="flex-1 font-display text-xl font-bold text-navy">{t(CONTENT_TYPE_LABELS[s.type])}</h2>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${tone.chip}`}>{s.items.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.items.map((f) => (
                <FileCard key={f.id} f={f} type={s.type} t={t} />
              ))}
            </div>
          </section>
        );
      })}

      {/* කලින් / ඊළඟ පාඩම */}
      {(prev || next) && (
        <nav aria-label={t("පාඩම් අතර")} className="grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={`/dashboard/lessons/${prev.id}`} className="card group flex items-center gap-3 p-4 transition hover:border-primary/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted transition group-hover:bg-primary group-hover:text-white" aria-hidden="true">←</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-muted">{t("කලින් පාඩම")}</span>
                <span className="block truncate font-semibold text-navy">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/dashboard/lessons/${next.id}`} className="card group flex items-center justify-end gap-3 p-4 text-right transition hover:border-primary/50">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-muted">{t("ඊළඟ පාඩම")}</span>
                <span className="block truncate font-semibold text-navy">{next.title}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
                <Icon name="arrow" className="h-5 w-5" />
              </span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, and, count } from "drizzle-orm";
import { createLessonAction } from "@/app/actions/content";
import { LessonCreateForm } from "@/components/content-forms";
import { ScopeFilter } from "@/components/scope-filter";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { parseScope } from "@/lib/content-scope";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පාඩම්") };
}

export default async function LessonsPage(props: PageProps<"/admin/lessons">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const { grade, medium } = parseScope(sp);
  const notice = sp.notice === "deleted" ? t("පාඩම මකා දමන ලදී.") : "";

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
    .where(and(eq(lessons.grade, grade), eq(lessons.medium, medium)))
    .groupBy(lessons.id)
    .orderBy(asc(lessons.order), asc(lessons.title));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">{t("පාඩම්")}</h1>
      <p className="text-sm text-muted">{t("ශ්‍රේණිය සහ මාධ්‍යය තෝරා, පාඩමකට Tute, පෙළපොත, වැඩපොත වැනි Google Drive links එක් කරන්න.")}</p>
      <ScopeFilter grade={grade} medium={medium} action="/admin/lessons" t={t} />
      {notice && <Alert kind="success">{notice}</Alert>}

      <h2 className="text-lg font-semibold">
        {gradeLabel(grade, null, t)} · {t(MEDIUM_LABELS[medium])} <span className="text-sm font-normal text-muted">({t("පාඩම් {n}", { n: rows.length })})</span>
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">{t("පාඩම් නැත.")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/lessons/${l.id}`}
                className="flex items-center gap-3 card p-4 transition hover:border-primary"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{l.order}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.title}</span>
                  <span className="text-xs text-muted">{t("Links {n}", { n: l.files })}</span>
                </span>
                {!l.isPublished && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-muted">{t("සඟවා ඇත")}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3 card p-5">
        <h2 className="font-semibold">{t("අලුත් පාඩමක් එක් කරන්න")}</h2>
        <LessonCreateForm action={createLessonAction} grade={grade} medium={medium} />
      </section>
    </div>
  );
}

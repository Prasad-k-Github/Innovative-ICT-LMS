import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { deleteLessonAction, deleteResourceAction, toggleLessonAction, toggleResourceAction, createResourceAction, updateLessonAction, updateResourceAction } from "@/app/actions/content";
import { LessonEditForm, ResourceForm } from "@/components/content-forms";
import { ConfirmButton } from "@/components/confirm-button";
import { ToneCard } from "@/components/cards";
import { RESOURCE_COLOR, RESOURCE_ICON, RESOURCE_TONE } from "@/lib/resource-meta";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { lessons, resources } from "@/db/schema";
import { CONTENT_TYPE_LABELS, LESSON_TYPES, MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { HeroBadge, PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පාඩම") };
}

const NOTICES: Record<string, string> = {
  created: "පාඩම එක් කරන ලදී. දැන් Drive links එක් කරන්න.",
  published: "පාඩම සිසුන්ට පෙනෙන ලෙස සකසන ලදී.",
  hidden: "පාඩම සිසුන්ගෙන් සඟවන ලදී.",
  "r-published": "Link එක සිසුන්ට පෙනෙන ලෙස සකසන ලදී.",
  "r-hidden": "Link එක සිසුන්ගෙන් සඟවන ලදී.",
  "r-deleted": "Link එක මකා දමන ලදී.",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LessonDetailPage(props: PageProps<"/admin/lessons/[id]">) {
  await requireAdmin();
  const t = await getT();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sp = await props.searchParams;

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!lesson) notFound();
  const files = await db.select().from(resources).where(eq(resources.lessonId, id)).orderBy(asc(resources.type), desc(resources.createdAt));

  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : "";
  const btn = "min-h-10 rounded-xl px-3 text-sm font-semibold transition";
  const card = "space-y-4 card p-5 sm:p-6";
  const back = `/admin/lessons?grade=${lesson.grade}&medium=${lesson.medium}`;

  const tab = pickTab(sp.tab, ["links", "add", "edit", "delete"]);
  const tabs = [
    { key: "links", label: t("Google Drive links"), href: tabHref(`/admin/lessons/${lesson.id}`, "links", true), count: files.length },
    { key: "add", label: t("අලුත් link එකක්"), href: tabHref(`/admin/lessons/${lesson.id}`, "add", false) },
    { key: "edit", label: t("පාඩමේ විස්තර"), href: tabHref(`/admin/lessons/${lesson.id}`, "edit", false) },
    { key: "delete", label: t("මකන්න"), href: tabHref(`/admin/lessons/${lesson.id}`, "delete", false), danger: true },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="book"
        back={{ href: back, label: `${gradeLabel(lesson.grade, null, t)} · ${t(MEDIUM_LABELS[lesson.medium])}` }}
        title={lesson.title}
        badges={
          <>
            <HeroBadge tone="sun">{t("පාඩම {n}", { n: lesson.order })}</HeroBadge>
            {!lesson.isPublished && <HeroBadge>{t("සඟවා ඇත")}</HeroBadge>}
          </>
        }
      />
      {notice && <Alert kind="success">{notice}</Alert>}

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "links" && (
        <section className={card}>
          <h2 className="font-display text-lg font-bold text-navy">{t("Google Drive links")}</h2>
          {files.length === 0 ? (
            <p className="text-sm text-muted">{t("තවම links නැත.")}</p>
          ) : (
            <ul className="space-y-3">
              {files.map((f) => (
                <li key={f.id}>
                <ToneCard tone={RESOURCE_COLOR[f.type]} className="space-y-2 p-3 pt-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RESOURCE_TONE[f.type].chip}`}><span aria-hidden="true">{RESOURCE_ICON[f.type]}</span>{t(CONTENT_TYPE_LABELS[f.type])}</span>
                    <span className="font-medium">{f.title || t(CONTENT_TYPE_LABELS[f.type])}</span>
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
                        types={LESSON_TYPES}
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
          )}
        </section>

      )}
      {tab === "add" && (
        <section className={card}>
          <h2 className="font-display text-lg font-bold text-navy">{t("අලුත් link එකක් එක් කරන්න")}</h2>
          <ResourceForm action={createResourceAction} types={LESSON_TYPES} lessonId={lesson.id} prefix="new" submitLabel={t("Link එක එක් කරන්න")} />
        </section>

      )}
      {tab === "edit" && (
        <section className={card}>
          <h2 className="font-display text-lg font-bold text-navy">{t("පාඩමේ විස්තර")}</h2>
          <LessonEditForm action={updateLessonAction} id={lesson.id} title={lesson.title} order={lesson.order} />
          <form>
            <button
              type="submit"
              formAction={toggleLessonAction.bind(null, lesson.id)}
              className={`${btn} border border-line bg-white hover:bg-slate-50`}
            >
              {lesson.isPublished ? t("පාඩම සිසුන්ගෙන් සඟවන්න") : t("පාඩම සිසුන්ට පෙන්වන්න")}
            </button>
          </form>
        </section>

      )}
      {tab === "delete" && (
        <section className="rounded-2xl border border-red-200 bg-white p-5">
          <h2 className="font-semibold text-red-700">{t("අන්තරායකර කලාපය")}</h2>
          <p className="mt-1 text-sm text-muted">{t("පාඩම සහ එහි සියලු links සදහටම මකා දමයි.")}</p>
          <form className="mt-3">
            <ConfirmButton
              message={t("\"{name}\" සහ එහි සියලු links මකා දමන්නද?", { name: lesson.title })}
              formAction={deleteLessonAction.bind(null, lesson.id)}
              className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
            >
              {t("පාඩම මකන්න")}
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}

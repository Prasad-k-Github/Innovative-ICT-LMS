import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { removeSubmissionFileAction } from "@/app/actions/student-work";
import { ConfirmButton } from "@/components/confirm-button";
import { HeroBadge, PageHero } from "@/components/page-hero";
import { UploadForm } from "@/components/student-work-forms";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { assignments, submissionFiles, submissions } from "@/db/schema";
import { UUID_RE, eligibleFor } from "@/lib/assessment";
import { UPLOAD_MAX_FILES } from "@/lib/constants";
import { getLang, getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";
import { formatColombo, nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පැවරුම") };
}

const NOTICES: Record<string, [string, "success" | "warning"]> = {
  removed: ["File එක ඉවත් කරන ලදී.", "success"],
  locked: ["අවසාන දිනය ඉකුත් වී ඇති නිසා හෝ ලකුණු දමා ඇති නිසා වෙනස් කළ නොහැක.", "warning"],
};
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function StudentAssignmentPage(props: PageProps<"/dashboard/assignments/[id]">) {
  const user = await requireStudent();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await props.searchParams;

  const [a] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, id), eligibleFor(user, assignments)))
    .limit(1);
  if (!a) notFound();

  const [sub] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.assignmentId, id), eq(submissions.studentId, user.id)))
    .limit(1);
  const files = sub
    ? await db
        .select({ id: submissionFiles.id, filename: submissionFiles.filename, size: submissionFiles.size })
        .from(submissionFiles)
        .where(eq(submissionFiles.submissionId, sub.id))
        .orderBy(asc(submissionFiles.createdAt))
    : [];

  const closed = a.dueAt.getTime() < nowMs();
  const locked = closed || !!sub?.gradedAt;
  const n = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const remaining = Math.max(0, UPLOAD_MAX_FILES - files.length);
  const card = "space-y-3 card p-5 sm:p-6";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="clipboard"
        back={{ href: "/dashboard/assignments", label: t("පැවරුම්") }}
        title={a.title}
        badges={
          <>
            <span className={`rounded-full px-3 py-1 ${closed ? "bg-accent text-white" : "bg-sun text-navy"}`}>
              {t("අවසාන දිනය")}: {formatColombo(a.dueAt, lang)}
            </span>
            {a.maxMarks ? <HeroBadge>{t("උපරිම ලකුණු {n}", { n: a.maxMarks })}</HeroBadge> : null}
          </>
        }
      />
      {n && <Alert kind={n[1]}>{t(n[0])}</Alert>}

      {(a.description || a.attachmentUrl) && (
        <section className={card}>
          {a.description && <p className="whitespace-pre-line text-sm leading-relaxed">{a.description}</p>}
          {a.attachmentUrl && (
            <a href={a.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:border-primary hover:bg-primary-soft">
              📄 {t("ප්‍රශ්න පත්‍රය / ඇමුණුම බලන්න")}
            </a>
          )}
        </section>
      )}

      {sub?.gradedAt && (
        <section className="space-y-1 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm">
          {sub.marks !== null && (
            <p className="text-lg font-bold text-green-900">
              {t("ලකුණු")}: {sub.marks}
              {a.maxMarks ? `/${a.maxMarks}` : ""}
            </p>
          )}
          {sub.feedback && <p className="whitespace-pre-line text-green-900">{sub.feedback}</p>}
        </section>
      )}

      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("ඔබ උඩුගත කළ files")}</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted">{t("තවම files උඩුගත කර නැත.")}</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                <a href={`/api/files/${f.id}`} className="min-w-0 break-all font-medium text-primary hover:underline">
                  ⬇ {f.filename} <span className="text-xs font-normal text-muted">({kb(f.size)})</span>
                </a>
                {!locked && (
                  <form>
                    <ConfirmButton
                      message={t("මෙම file එක ඉවත් කරන්නද?")}
                      formAction={removeSubmissionFileAction.bind(null, f.id)}
                      className="min-h-10 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      {t("ඉවත් කරන්න")}
                    </ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {sub && <p className="text-xs text-muted">{t("ඉදිරිපත් කළේ")} {formatColombo(sub.submittedAt, lang)}</p>}
      </section>

      {locked ? (
        <Alert kind="warning">{sub?.gradedAt ? t("ලකුණු දමා ඇති නිසා වෙනස් කළ නොහැක.") : t("අවසාන දිනය ඉකුත් වී ඇති නිසා උඩුගත කළ නොහැක.")}</Alert>
      ) : remaining === 0 ? (
        <Alert kind="info">{t("එක් පැවරුමකට උපරිම files 5ක් පමණි. අලුත් file එකක් එක් කිරීමට පැරණි එකක් ඉවත් කරන්න.")}</Alert>
      ) : (
        <section className={card}>
          <h2 className="font-display text-lg font-bold text-navy">{files.length ? t("තවත් file එක් කරන්න") : t("පැවරුම උඩුගත කරන්න")}</h2>
          <UploadForm assignmentId={a.id} remaining={remaining} />
        </section>
      )}
    </div>
  );
}

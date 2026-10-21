import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { deleteAssignmentAction, deleteSubmissionAction, gradeSubmissionAction, toggleAssignmentAction, updateAssignmentAction } from "@/app/actions/assessment";
import { AssignmentForm, GradeForm } from "@/components/assessment-forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { assignments, institutes, submissionFiles, submissions, users } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { targetLabel } from "@/lib/target";
import { formatColombo, toColomboInput } from "@/lib/time";
import { HeroBadge, PageHero } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("පැවරුම") };
}

const NOTICES: Record<string, string> = {
  created: "පැවරුම පවරන ලදී.",
  published: "පැවරුම සිසුන්ට පෙනෙන ලෙස සකසන ලදී.",
  hidden: "පැවරුම සිසුන්ගෙන් සඟවන ලදී.",
  "sub-deleted": "ඉදිරිපත් කිරීම මකා දමන ලදී. සිසුවාට නැවත උඩුගත කළ හැක.",
};

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function AssignmentDetailPage(props: PageProps<"/admin/assignments/[id]">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await props.searchParams;

  const [a] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  if (!a) notFound();
  const [inst, [instRow]] = await Promise.all([
    db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name)),
    db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, a.instituteId ?? "")).limit(1),
  ]);

  const subs = await db
    .select({ s: submissions, name: users.name, school: users.school, phone: users.phone })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .where(eq(submissions.assignmentId, id))
    .orderBy(asc(submissions.submittedAt));
  const files = subs.length
    ? await db
        .select({ id: submissionFiles.id, submissionId: submissionFiles.submissionId, filename: submissionFiles.filename, size: submissionFiles.size })
        .from(submissionFiles)
        .where(inArray(submissionFiles.submissionId, subs.map((x) => x.s.id)))
        .orderBy(asc(submissionFiles.createdAt))
    : [];

  // පවරා ඇති නමුත් තවම ඉදිරිපත් නොකළ සිසුන්
  const submittedIds = subs.map((x) => x.s.studentId);
  const missing = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.role, "STUDENT"),
        eq(users.status, "ACTIVE"),
        eq(users.grade, a.grade),
        eq(users.medium, a.medium),
        a.instituteId ? eq(users.instituteId, a.instituteId) : undefined,
        submittedIds.length ? notInArray(users.id, submittedIds) : undefined,
      ),
    )
    .orderBy(asc(users.name));

  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : "";
  const btn = "min-h-10 rounded-xl px-3 text-sm font-semibold transition";
  const card = "space-y-4 card p-5 sm:p-6";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        icon="clipboard"
        back={{ href: "/admin/assignments", label: t("පැවරුම්") }}
        title={a.title}
        badges={
          <>
            <HeroBadge tone="sun">{t("අවසාන දිනය")}: {formatColombo(a.dueAt, lang)}</HeroBadge>
            {!a.isPublished && <HeroBadge>{t("සඟවා ඇත")}</HeroBadge>}
          </>
        }
        subtitle={targetLabel({ grade: a.grade, medium: a.medium, instituteName: instRow?.name }, t)}
      />
      {notice && <Alert kind="success">{notice}</Alert>}

      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">
          {t("ඉදිරිපත් කිරීම්")} <span className="text-sm font-normal text-muted">({subs.length})</span>
        </h2>
        {subs.length === 0 ? (
          <p className="text-sm text-muted">{t("තවම කිසිවෙකු ඉදිරිපත් කර නැත.")}</p>
        ) : (
          <ul className="space-y-4">
            {subs.map(({ s, name, school, phone }) => (
              <li key={s.id} data-submission={s.id} className="space-y-3 rounded-xl border border-line p-4">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-xs text-muted">
                    {school} · {phone} · {t("ඉදිරිපත් කළේ")} {formatColombo(s.submittedAt, lang)}
                    {s.submittedAt.getTime() > a.dueAt.getTime() && <span className="ml-1 text-amber-700">({t("ප්‍රමාදයි")})</span>}
                  </p>
                  {s.note && <p className="mt-1 text-sm">“{s.note}”</p>}
                </div>
                <ul className="space-y-1 text-sm">
                  {files
                    .filter((f) => f.submissionId === s.id)
                    .map((f) => (
                      <li key={f.id}>
                        <a href={`/api/files/${f.id}`} className="font-medium text-primary hover:underline">
                          ⬇ {f.filename}
                        </a>{" "}
                        <span className="text-xs text-muted">({kb(f.size)})</span>
                      </li>
                    ))}
                </ul>
                <GradeForm action={gradeSubmissionAction} id={s.id} marks={s.marks === null ? "" : String(s.marks)} feedback={s.feedback ?? ""} maxMarks={a.maxMarks} />
                <form>
                  <ConfirmButton
                    message={t("{name} ගේ ඉදිරිපත් කිරීම මකා දමන්නද? සිසුවාට නැවත උඩුගත කළ හැක.", { name })}
                    formAction={deleteSubmissionAction.bind(null, s.id)}
                    className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                  >
                    {t("ඉදිරිපත් කිරීම මකන්න")}
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-primary">{t("තවම ඉදිරිපත් නොකළ සිසුන් ({n})", { n: missing.length })}</summary>
            <ul className="mt-2 list-inside list-disc text-sm text-muted">
              {missing.map((m) => (
                <li key={m.id}>{m.name}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("පැවරුමේ විස්තර")}</h2>
        <AssignmentForm
          action={updateAssignmentAction}
          institutes={inst}
          id={a.id}
          submitLabel={t("සුරකින්න")}
          initial={{
            title: a.title,
            description: a.description,
            grade: String(a.grade),
            medium: a.medium,
            instituteId: a.instituteId ?? "",
            attachmentUrl: a.attachmentUrl ?? "",
            dueAt: toColomboInput(a.dueAt),
            maxMarks: a.maxMarks ? String(a.maxMarks) : "",
          }}
        />
        <form>
          <button type="submit" formAction={toggleAssignmentAction.bind(null, a.id)} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
            {a.isPublished ? t("පැවරුම සිසුන්ගෙන් සඟවන්න") : t("පැවරුම සිසුන්ට පෙන්වන්න")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold text-red-700">{t("අන්තරායකර කලාපය")}</h2>
        <p className="mt-1 text-sm text-muted">{t("පැවරුම සහ සිසුන් උඩුගත කළ සියලු files සදහටම මකා දමයි.")}</p>
        <form className="mt-3">
          <ConfirmButton
            message={t("\"{name}\" සහ සියලු ඉදිරිපත් කිරීම් මකා දමන්නද?", { name: a.title })}
            formAction={deleteAssignmentAction.bind(null, a.id)}
            className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
          >
            {t("පැවරුම මකන්න")}
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}

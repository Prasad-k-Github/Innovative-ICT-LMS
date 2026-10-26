import type { Metadata } from "next";
import { avatarUrlOf } from "@/lib/avatar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { resendEmailAction, studentsAction, updateParentContactAdminAction, updateStudentAction } from "@/app/actions/admin";
import { ParentContactForm } from "@/components/parent-contact-form";
import { ConfirmButton } from "@/components/confirm-button";
import { ResetTempPasswordPanel } from "@/components/temp-credentials";
import { StudentForm } from "@/components/student-form";
import { Alert, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { auditLogs, changeRequests, institutes, users } from "@/db/schema";
import { ACTION_LABELS } from "@/lib/activity";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { WEAK_PCT, loadStudentProgress } from "@/lib/progress";
import { requireAdmin } from "@/lib/session";
import { SuspensionFields } from "@/components/suspension-fields";
import { suspensionLabels } from "@/lib/suspension-labels";
import { releaseExpiredSuspensions } from "@/lib/suspension";
import { nowMs, toColomboInput } from "@/lib/time";
import { PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සිසුවා") };
}

const NOTICES: Record<string, [("success" | "warning" | "error"), string]> = {
  created: ["success", "සිසුවා එක් කරන ලදී. මුරපදය සකසා ගැනීමට Email ඇරයුමක් යවන ලදී."],
  "created-nomail": ["warning", "සිසුවා එක් කරන ලදී, නමුත් Email යැවීම අසාර්ථකයි. පහත 'ඇරයුම නැවත යවන්න' භාවිතා කරන්න."],
  "mail-sent": ["success", "Email යවන ලදී."],
  "mail-failed": ["error", "Email යැවීම අසාර්ථකයි. පසුව නැවත උත්සාහ කරන්න."],
  "mail-skipped": ["warning", "මෙම සිසුවාට එම Email යැවීම අදාළ නොවේ."],
  "suspend-temp.1": ["success", "සිසුවා තාවකාලිකව අත්හිටුවන ලදී (කාලය ඉකුත් වූ විට ස්වයංක්‍රීයව සක්‍රිය වේ)."],
  "suspend-perm.1": ["success", "සිසුවා ස්ථිරවම අත්හිටුවන ලදී."],
  "activate.1": ["success", "සිසුවා නැවත සක්‍රිය කරන ලදී."],
  "approve.1": ["success", "සිසුවා අනුමත කරන ලදී."],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage(props: PageProps<"/admin/students/[id]">) {
  await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sp = await props.searchParams;
  await releaseExpiredSuspensions(id);

  const [s] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "STUDENT")))
    .limit(1);
  if (!s) notFound();

  const list = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));
  const actorUser = alias(users, "actor_user");
  const [history, reqs] = await Promise.all([
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actorName: actorUser.name, actorId: auditLogs.actorId })
      .from(auditLogs)
      .leftJoin(actorUser, eq(actorUser.id, auditLogs.actorId))
      .where(or(eq(auditLogs.targetId, id), eq(auditLogs.actorId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
    db
      .select({
        id: changeRequests.id,
        status: changeRequests.status,
        grade: changeRequests.grade,
        alYear: changeRequests.alYear,
        medium: changeRequests.medium,
        note: changeRequests.note,
        createdAt: changeRequests.createdAt,
        institute: institutes.name,
      })
      .from(changeRequests)
      .leftJoin(institutes, eq(institutes.id, changeRequests.instituteId))
      .where(eq(changeRequests.userId, id))
      .orderBy(desc(changeRequests.createdAt))
      .limit(10),
  ]);

  const notice = sp.error === "bad-date"
    ? (["error", "අත්හිටුවීම අවසන් වන දිනය වලංගු නොවේ. අනාගත දිනයක් (වසරක් ඇතුළත) තෝරන්න."] as ["error", string])
    : typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const minDate = toColomboInput(new Date(nowMs())).slice(0, 10);

  const here = `/admin/students/${s.id}`;
  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold transition";
  const fmt = (d: Date | null) => (d ? d.toLocaleString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" }) : "—");

  const tab = pickTab(sp.tab, ["overview", "progress", "edit", "requests", "history", "delete"]);
  const prog = tab === "progress" ? await loadStudentProgress(id) : null;
  const tabs = [
    { key: "overview", label: t("සාරාංශය"), href: tabHref(`/admin/students/${s.id}`, "overview", true) },
    { key: "progress", label: t("ප්‍රගතිය"), href: tabHref(`/admin/students/${s.id}`, "progress", false) },
    { key: "edit", label: t("විස්තර සංස්කරණය"), href: tabHref(`/admin/students/${s.id}`, "edit", false) },
    { key: "requests", label: t("වෙනස් කිරීමේ ඉල්ලීම්"), href: tabHref(`/admin/students/${s.id}`, "requests", false), count: reqs.length },
    { key: "history", label: t("ක්‍රියා ඉතිහාසය"), href: tabHref(`/admin/students/${s.id}`, "history", false) },
    { key: "delete", label: t("මකන්න"), href: tabHref(`/admin/students/${s.id}`, "delete", false), danger: true },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero icon="user" person={{ name: s.name, src: await avatarUrlOf(s.id) }} back={{ href: "/admin/students", label: t("සිසුන්") }} title={s.name} badges={<StatusBadge status={s.status} t={t} suspension={s.status === "SUSPENDED" ? (s.suspendedUntil ? "temp" : "perm") : undefined} />} />

      {notice && <Alert kind={notice[0]}>{t(notice[1])}</Alert>}

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "overview" && (
        <section className="card p-5 text-sm">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted">{t("Index අංකය")}</dt>
            <dd className="font-mono" data-testid="detail-index">{s.indexNo ?? "—"}</dd>
            <dt className="text-muted">{t("ලියාපදිංචි වූ දිනය")}</dt>
            <dd>{fmt(s.createdAt)}</dd>
            <dt className="text-muted">{t("Email තහවුරු කිරීම")}</dt>
            <dd>{s.emailVerified ? `✓ ${t("තහවුරු කර ඇත")}` : t("තවම නැත")}</dd>
            <dt className="text-muted">{t("අවසන් Login")}</dt>
            <dd>{fmt(s.lastLoginAt)}</dd>
          </dl>
        </section>

      )}
      {tab === "progress" && (
        <div className="space-y-5" data-testid="student-progress">
          {!prog ? (
            <Alert kind="warning">{t("මෙම සිසුවාට මාධ්‍යය තෝරා නැති නිසා ප්‍රගතිය පෙන්විය නොහැක.")}</Alert>
          ) : (
            <>
              <section className="card space-y-3 p-5">
                <h2 className="font-display text-lg font-bold text-navy">
                  {t("පාඩම්")} · {prog.lessons.filter((l) => l.viewedAt).length}/{prog.lessons.length}
                </h2>
                {prog.lessons.length === 0 ? (
                  <p className="text-sm text-muted">{t("පාඩම් නැත.")}</p>
                ) : (
                  <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                    {prog.lessons.map((l) => (
                      <li key={l.id} data-lesson-progress={l.id} data-viewed={l.viewedAt ? "1" : "0"} className="flex items-center gap-2">
                        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${l.viewedAt ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-muted"}`} aria-hidden="true">
                          {l.viewedAt ? "✓" : "–"}
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${l.viewedAt ? "text-navy" : "text-muted"}`}>{l.title}</span>
                        {l.viewedAt && <span className="shrink-0 text-xs text-muted">{fmt(l.viewedAt)} · ×{l.views}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="card space-y-3 p-5">
                <h2 className="font-display text-lg font-bold text-navy">{t("Quiz ලකුණු (කාලය අනුව)")}</h2>
                {prog.quizScores.length === 0 ? (
                  <p className="text-sm text-muted">{t("තවම Quiz සම්පූර්ණ කර නැත.")}</p>
                ) : (
                  <ul className="space-y-2 text-sm" data-testid="quiz-scores">
                    {prog.quizScores.map((q, i) => (
                      <li key={`${q.quizId}-${i}`} className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-navy">{q.title}</span>
                          <span className="text-xs text-muted">
                            {fmt(q.at)} · {q.score}/{q.total} · <b className={q.pct < WEAK_PCT ? "text-accent" : "text-emerald-700"}>{q.pct}%</b>
                          </span>
                        </div>
                        <span className="block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                          <span className={`block h-full rounded-full ${q.pct < WEAK_PCT ? "bg-accent" : "bg-emerald-500"}`} style={{ width: `${q.pct}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {prog.weak.length > 0 && (
                <section className="card space-y-2 border-accent/30 p-5" data-testid="weak-list">
                  <h2 className="font-display text-lg font-bold text-accent">{t("දුර්වල ප්‍රදේශ (ලකුණු {n}% ට අඩු Quiz)", { n: WEAK_PCT })}</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {prog.weak.map((q, i) => (
                      <li key={`${q.quizId}-${i}`}>
                        {q.title} — <b>{q.pct}%</b>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="card space-y-3 p-5">
                <h2 className="font-display text-lg font-bold text-navy">{t("පැවරුම්")}</h2>
                {prog.assignments.length === 0 ? (
                  <p className="text-sm text-muted">{t("දැනට පැවරුම් නැත.")}</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {prog.assignments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-navy">{a.title}</span>
                        <span className="text-xs text-muted">
                          {a.sub ? (
                            <>
                              <b className="text-emerald-700">{t("ඉදිරිපත් කළා")}</b>
                              {a.sub.gradedAt && a.sub.marks !== null ? ` · ${t("ලකුණු")}: ${a.sub.marks}${a.maxMarks ? `/${a.maxMarks}` : ""}` : ""}
                            </>
                          ) : a.dueAt.getTime() < nowMs() ? (
                            <b className="text-accent">{t("කාලය ඉකුත් වී ඇත")}</b>
                          ) : (
                            t("ඉදිරිපත් කර නැත")
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
      {tab === "overview" && (
        <section className="space-y-3 card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t("ගිණුම් ක්‍රියා")}</h2>
          <form className="flex flex-wrap gap-2">
            <input type="hidden" name="single" value={s.id} />
            <input type="hidden" name="returnTo" value={here} />
            {s.status === "PENDING" && (
              <button type="submit" formAction={studentsAction.bind(null, "approve")} className={`${btn} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800`}>
                {t("අනුමත කරන්න")}
              </button>
            )}
            {s.status === "SUSPENDED" && (
              <button type="submit" formAction={studentsAction.bind(null, "activate")} className={`${btn} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800`}>
                {t("නැවත සක්‍රිය කරන්න")}
              </button>
            )}
            {!s.emailVerified && (
              <button type="submit" formAction={resendEmailAction.bind(null, "verify")} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                {t("තහවුරු කිරීමේ Email නැවත යවන්න")}
              </button>
            )}
          </form>
          {(s.status === "ACTIVE" || s.status === "SUSPENDED") && (
            <form data-testid="suspend-panel" className="mt-2 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <input type="hidden" name="single" value={s.id} />
              <input type="hidden" name="returnTo" value={here} />
              <h3 className="font-semibold text-navy">{s.status === "SUSPENDED" ? t("අත්හිටුවීම වෙනස් කරන්න") : t("ගිණුම අත්හිටුවන්න")}</h3>
              {s.status === "SUSPENDED" && (
                <p data-testid="suspend-state" className="text-sm text-amber-900">
                  {s.suspendedUntil ? t("{date} දක්වා තාවකාලිකව අත්හිටුවා ඇත.", { date: fmt(s.suspendedUntil) }) : t("ස්ථිරවම අත්හිටුවා ඇත.")}
                  {s.suspendReason ? ` ${t("හේතුව")}: ${s.suspendReason}` : ""}
                </p>
              )}
              <SuspensionFields labels={suspensionLabels(t)} minDate={minDate} />
              <p className="text-xs text-muted">{t("අත්හිටුවූ විගස සියලු devices වල logout වේ. තාවකාලික අත්හිටුවීමක් කාලය ඉකුත් වූ විට ස්වයංක්‍රීයව අවසන් වේ.")}</p>
              <button type="submit" formAction={studentsAction.bind(null, "suspend")} data-testid="suspend-submit" className={`${btn} bg-sun text-navy shadow-sm hover:brightness-95`}>
                {s.status === "SUSPENDED" ? t("යාවත්කාලීන කරන්න") : t("අත්හිටුවන්න")}
              </button>
            </form>
          )}
          <ResetTempPasswordPanel id={s.id} />
          <p className="text-xs text-muted">
            {t("සිසුන්ගේ මුරපද Admin ට බැලීමට නොහැක (ගබඩා වන්නේ hash පමණි). අලුත් තාවකාලික මුරපදයක් ජනනය කළ හැක.")}
          </p>
        </section>

      )}
      {tab === "edit" && (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 font-semibold">{t("විස්තර සංස්කරණය")}</h2>
          <StudentForm
            action={updateStudentAction}
            institutes={list}
            id={s.id}
            submitLabel={t("සුරකින්න")}
            initial={{
              name: s.name,
              school: s.school,
              grade: String(s.grade),
              alYear: s.alYear ? String(s.alYear) : "",
              medium: s.medium ?? "",
              phone: s.phone,
              email: s.email,
              instituteId: s.instituteId ?? "",
            }}
          />
        </section>
      )}
      {tab === "edit" && (
        <section className="card space-y-4 p-5 sm:p-6" data-testid="admin-parent-section">
          <h2 className="font-semibold">{t("දෙමාපිය සම්බන්ධතා")}</h2>
          <ParentContactForm
            action={updateParentContactAdminAction}
            id={s.id}
            initial={{ parentEmail: s.parentEmail ?? "", parentPhone: s.parentPhone ?? "" }}
          />
        </section>
      )}
      {tab === "requests" && (
        <section className="space-y-3 card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-navy">{t("වෙනස් කිරීමේ ඉල්ලීම්")}</h2>
          {reqs.length === 0 ? (
            <p className="text-sm text-muted">{t("ඉල්ලීම් නැත.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reqs.map((r) => (
                <li key={r.id} className="border-b border-line pb-2 last:border-0 last:pb-0">
                  <p>
                    <strong>
                      {gradeLabel(r.grade, r.alYear, t)} · {t(MEDIUM_LABELS[r.medium])} · {r.institute ?? "—"}
                    </strong>{" "}
                    <span className={r.status === "APPROVED" ? "text-green-700" : r.status === "REJECTED" ? "text-red-700" : "text-amber-700"}>
                      {r.status === "APPROVED" ? t("අනුමත කළා") : r.status === "REJECTED" ? t("ප්‍රතික්ෂේප කළා") : t("අනුමැතිය බලාපොරොත්තුවෙන්")}
                    </span>
                  </p>
                  {r.note && <p className="text-muted">{r.note}</p>}
                  <p className="text-xs text-muted">{fmt(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {reqs.some((r) => r.status === "PENDING") && (
            <Link href="/admin/requests" className="text-sm font-semibold text-primary hover:underline">
              {t("ඉල්ලීම් පිටුවට යන්න →")}
            </Link>
          )}
        </section>

      )}
      {tab === "history" && (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-3 font-semibold">{t("ක්‍රියා ඉතිහාසය")}</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">{t("ක්‍රියා නැත.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span>
                    {t(ACTION_LABELS[h.action] ?? h.action)}
                    {h.actorId && h.actorId !== id && <span className="text-muted"> · {h.actorName ?? t("(ඉවත් කළ පරිශීලකයෙක්)")}</span>}
                  </span>
                  <span className="text-xs text-muted">{fmt(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

      )}
      {tab === "delete" && (
        <section className="rounded-2xl border border-red-200 bg-white p-5">
          <h2 className="font-semibold text-red-700">{t("අන්තරායකර කලාපය")}</h2>
          <p className="mt-1 text-sm text-muted">{t("සිසුවා සදහටම මකා දමයි. මෙය ආපසු හැරවිය නොහැක.")}</p>
          <form className="mt-3">
            <input type="hidden" name="single" value={s.id} />
            <input type="hidden" name="returnTo" value="/admin/students" />
            <ConfirmButton
              message={t("{name} සදහටම මකා දමන්නද?", { name: s.name })}
              title={t("සිසුවා සදහටම මකන්නද?")}
              confirmLabel={t("ඔව්, සදහටම මකන්න")}
              verifyText={s.name}
              testId="student-delete"
              formAction={studentsAction.bind(null, "delete")}
              className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
            >
              {t("සිසුවා මකන්න")}
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}

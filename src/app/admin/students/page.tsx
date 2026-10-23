import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, desc, eq } from "drizzle-orm";
import { studentOneAction, studentsAction } from "@/app/actions/admin";
import { Avatar, Chip, ToneCard } from "@/components/cards";
import { ConfirmButton } from "@/components/confirm-button";
import { SelectAll } from "@/components/select-all";
import { Alert, StatusBadge, inputClass } from "@/components/ui";
import { db } from "@/db";
import { avatarSrc } from "@/lib/avatar";
import { institutes, users, userAvatars } from "@/db/schema";
import { GRADES, MEDIUM_LABELS, PAGE_SIZE, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { SuspensionFields } from "@/components/suspension-fields";
import { suspensionLabels } from "@/lib/suspension-labels";
import { releaseExpiredSuspensions } from "@/lib/suspension";
import { formatColombo, nowMs, toColomboInput } from "@/lib/time";
import type { T } from "@/lib/i18n/core";
import { requireAdmin } from "@/lib/session";
import { filterQueryString, parseFilters, studentWhere } from "@/lib/student-query";
import { EmptyState, PageHero, heroBtn, heroBtnGhost } from "@/components/page-hero";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සිසුන්") };
}

function noticeText(code: string, t: T) {
  if (code === "none") return t("කිසිවෙකු තෝරා නැත. පළමුව සිසුන් තෝරන්න.");
  const [op, n] = code.split(".");
  const count = Number(n);
  if (Number.isNaN(count)) return "";
  const msgs: Record<string, string> = {
    approve: "සිසුන් {n}ක් අනුමත කරන ලදී.",
    activate: "සිසුන් {n}ක් නැවත සක්‍රිය කරන ලදී.",
    "suspend-temp": "සිසුන් {n}ක් තාවකාලිකව අත්හිටුවන ලදී (කාලය ඉකුත් වූ විට ස්වයංක්‍රීයව සක්‍රිය වේ).",
    "suspend-perm": "සිසුන් {n}ක් ස්ථිරවම අත්හිටුවන ලදී.",
    delete: "සිසුන් {n}ක් මකා දමන ලදී.",
  };
  if (!msgs[op]) return "";
  return count === 0
    ? t("තෝරාගත් සිසුන් සඳහා මෙම ක්‍රියාව අදාළ නොවීය (දැනටමත් එම තත්ත්වයේ ඇත).")
    : t(msgs[op], { n: count });
}

export default async function StudentsPage(props: PageProps<"/admin/students">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const filters = parseFilters(sp);
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const notice = typeof sp.notice === "string" ? noticeText(sp.notice, t) : "";
  const errorMsg = sp.error === "bad-date" ? t("අත්හිටුවීම අවසන් වන දිනය වලංගු නොවේ. අනාගත දිනයක් (වසරක් ඇතුළත) තෝරන්න.") : "";
  await releaseExpiredSuspensions();

  const where = studentWhere(filters);
  const [[{ total }], rows, instituteList] = await Promise.all([
    db.select({ total: count() }).from(users).where(where),
    db
      .select({
        id: users.id,
        name: users.name,
        school: users.school,
        grade: users.grade,
        alYear: users.alYear,
        medium: users.medium,
        phone: users.phone,
        email: users.email,
        indexNo: users.indexNo,
        status: users.status,
        suspendedUntil: users.suspendedUntil,
        suspendReason: users.suspendReason,
        emailVerified: users.emailVerified,
        institute: institutes.name,
        avatarAt: userAvatars.updatedAt,
      })
      .from(users)
      .leftJoin(institutes, eq(institutes.id, users.instituteId))
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select().from(institutes).orderBy(asc(institutes.name)),
  ]);

  const minDate = toColomboInput(new Date(nowMs())).slice(0, 10);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentUrl = `/admin/students${filterQueryString(filters, page > 1 ? { page: String(page) } : {})}`;
  const hasFilters = Object.values(filters).some(Boolean);

  const btn = "min-h-10 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-60";
  const suspend = studentsAction.bind(null, "suspend");
  const activate = studentsAction.bind(null, "activate");
  const approve = studentsAction.bind(null, "approve");
  const del = studentsAction.bind(null, "delete");

  return (
    <div className="space-y-6">
      <PageHero
        icon="users"
        title={t("සිසුන්")}
        subtitle={t("ලියාපදිංචි සිසුන් සොයා, අනුමත කර, කළමනාකරණය කරන්න.")}
        actions={
          <>
            <a href={`/admin/students/export${filterQueryString(filters)}`} className={heroBtnGhost}>
              {t("CSV බාගන්න")}
            </a>
            <Link href="/admin/students/new" className={heroBtn}>
              {t("+ අලුත් සිසුවෙක්")}
            </Link>
          </>
        }
      />

      {notice && <Alert kind="success">{notice}</Alert>}
      {errorMsg && <Alert kind="error">{errorMsg}</Alert>}

      {/* Search සහ filter (GET) */}
      <form method="get" className="grid gap-3 card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder={t("නම, email, දුරකතනය, පාසල...")}
          aria-label={t("සොයන්න")}
          className={`${inputClass} sm:col-span-2`}
        />
        <select name="grade" defaultValue={filters.grade} aria-label={t("ශ්‍රේණිය")} className={inputClass}>
          <option value="">{t("සියලු ශ්‍රේණි")}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {gradeLabel(g, null, t)}
            </option>
          ))}
        </select>
        <select name="medium" defaultValue={filters.medium} aria-label={t("මාධ්‍යය")} className={inputClass}>
          <option value="">{t("සියලු මාධ්‍ය")}</option>
          <option value="SINHALA">{t(MEDIUM_LABELS.SINHALA)}</option>
          <option value="ENGLISH">{t(MEDIUM_LABELS.ENGLISH)}</option>
        </select>
        <select name="institute" defaultValue={filters.institute} aria-label={t("ආයතනය")} className={inputClass}>
          <option value="">{t("සියලු ආයතන")}</option>
          {instituteList.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status} aria-label={t("තත්ත්වය")} className={inputClass}>
          <option value="">{t("සියලු තත්ත්ව")}</option>
          <option value="PENDING">{t("අනුමැතිය බලාපොරොත්තුවෙන්")}</option>
          <option value="ACTIVE">{t("සක්‍රියයි")}</option>
          <option value="SUSPENDED">{t("අත්හිටුවා ඇත")}</option>
          <option value="SUSPENDED_TEMP">{t("තාවකාලිකව අත්හිටුවා ඇත")}</option>
          <option value="SUSPENDED_PERM">{t("ස්ථිරවම අත්හිටුවා ඇත")}</option>
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className={`${btn} bg-primary px-5 text-white hover:bg-primary-dark`}>
            {t("සොයන්න")}
          </button>
          {hasFilters && (
            <Link href="/admin/students" className={`${btn} inline-flex items-center border border-line bg-white px-5`}>
              {t("හිස් කරන්න")}
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted">
        {t("සිසුන් {n}ක්", { n: total })}{hasFilters ? ` ${t("(filter කර ඇත)")}` : ""}
      </p>

      {/* Bulk සහ තනි ක්‍රියා: එකම form එකක් */}
      <form className="space-y-3">
        <input type="hidden" name="returnTo" value={currentUrl} />

        <div className="sticky top-[88px] z-[5] flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/95 p-3 backdrop-blur">
          <SelectAll label={t("සියල්ල තෝරන්න")} />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <button type="submit" formAction={approve} className={`${btn} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800`}>
            {t("අනුමත කරන්න")}
          </button>
          <SuspensionFields labels={suspensionLabels(t)} compact minDate={minDate} />
          <button type="submit" formAction={suspend} data-testid="bulk-suspend" className={`${btn} bg-sun text-navy shadow-sm hover:brightness-95`}>
            {t("අත්හිටුවන්න")}
          </button>
          <button type="submit" formAction={activate} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
            {t("නැවත සක්‍රිය කරන්න")}
          </button>
          <ConfirmButton
            message={t("තෝරාගත් සිසුන් සදහටම මකා දමන්නද? මෙය ආපසු හැරවිය නොහැක.")}
            title={t("සිසුන් සදහටම මකන්නද?")}
            confirmLabel={t("ඔව්, සදහටම මකන්න")}
            verifyText={t("මකන්න")}
            selectedSelector="input[name=ids]:checked"
            selectedTemplate={t("තෝරාගත් සිසුන් {n}ක්")}
            testId="bulk-delete"
            formAction={del}
            className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
          >
            {t("මකන්න")}
          </ConfirmButton>
        </div>

        {rows.length === 0 ? (
          <EmptyState>{hasFilters ? t("මෙම සෙවුමට ගැළපෙන සිසුන් නැත.") : t("තවම සිසුන් නැත.")}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {rows.map((s) => (
              <li key={s.id}>
                <ToneCard tone={s.status === "ACTIVE" ? "green" : s.status === "PENDING" ? "sun" : "red"} className="p-4 pt-5">
                <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                  <input
                    type="checkbox"
                    name="ids"
                    value={s.id}
                    aria-label={t("{name} තෝරන්න", { name: s.name })}
                    className="mt-1 h-6 w-6 shrink-0 accent-primary"
                  />
                  <Avatar name={s.name} src={s.avatarAt ? avatarSrc(s.id, s.avatarAt) : null} />
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/students/${s.id}`} className="text-base font-semibold hover:text-primary hover:underline">
                        {s.name}
                      </Link>
                      <StatusBadge status={s.status} t={t} suspension={s.status === "SUSPENDED" ? (s.suspendedUntil ? "temp" : "perm") : undefined} />
                      {!s.emailVerified && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted">{t("Email තහවුරු කර නැත")}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip tone="blue">{gradeLabel(s.grade, s.alYear, t)}</Chip>
                      {s.medium && <Chip tone="violet">{t(MEDIUM_LABELS[s.medium])}</Chip>}
                      <Chip tone="cyan" icon="building">{s.institute ?? t("ආයතනය නැත")}</Chip>
                    </div>
                    {s.status === "SUSPENDED" && (
                      <p className="text-amber-800" data-testid="suspend-info">
                        {s.suspendedUntil ? t("{date} දක්වා", { date: formatColombo(s.suspendedUntil) }) : t("ස්ථිරවම")}
                        {s.suspendReason ? ` · ${s.suspendReason}` : ""}
                      </p>
                    )}
                    <p className="text-muted">{s.school}</p>
                    <p className="break-all text-muted">
                      {s.email} · {s.phone}
                    </p>
                    <p className="font-mono text-xs text-navy" data-testid="row-index">{s.indexNo ?? "—"}</p>
                  </div>
                  <div className="flex w-full shrink-0 flex-row gap-2 sm:w-auto">
                    {s.status === "PENDING" && (
                      <button type="submit" formAction={studentOneAction.bind(null, "approve", s.id)} className={`${btn} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800`}>
                        {t("අනුමත")}
                      </button>
                    )}
                    {s.status === "ACTIVE" && (
                      <Link href={`/admin/students/${s.id}`} className={`${btn} inline-flex items-center border border-amber-300 bg-white text-amber-800 hover:bg-amber-50`}>
                        {t("අත්හිටුවන්න")}
                      </Link>
                    )}
                    {s.status === "SUSPENDED" && (
                      <button type="submit" formAction={studentOneAction.bind(null, "activate", s.id)} className={`${btn} border border-green-300 bg-white text-green-800 hover:bg-green-50`}>
                        {t("සක්‍රිය කරන්න")}
                      </button>
                    )}
                    <Link href={`/admin/students/${s.id}`} className={`${btn} inline-flex items-center border border-line bg-white hover:bg-slate-50`}>
                      {t("සංස්කරණය")}
                    </Link>
                  </div>
                </div>
                </ToneCard>
              </li>
            ))}
          </ul>
        )}
      </form>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t("පිටු")}>
          {page > 1 ? (
            <Link href={`/admin/students${filterQueryString(filters, { page: String(page - 1) })}`} className={`${btn} inline-flex items-center border border-line bg-white`}>
              {t("← කලින්")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {t("පිටුව {page} / {pages}", { page, pages })}
          </span>
          {page < pages ? (
            <Link href={`/admin/students${filterQueryString(filters, { page: String(page + 1) })}`} className={`${btn} inline-flex items-center border border-line bg-white`}>
              {t("ඊළඟ →")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

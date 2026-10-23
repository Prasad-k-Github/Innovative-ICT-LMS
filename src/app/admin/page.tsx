import type { Metadata } from "next";
import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { studentOneAction } from "@/app/actions/admin";
import { ConfirmButton } from "@/components/confirm-button";
import { Avatar, Chip, StatCard, ToneCard } from "@/components/cards";
import { EmptyState, HeroBadge, PageHero } from "@/components/page-hero";
import { db } from "@/db";
import { avatarSrc } from "@/lib/avatar";
import { changeRequests, institutes, users, userAvatars } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { releaseExpiredSuspensions } from "@/lib/suspension";
import { getT } from "@/lib/i18n/server";
import { Icon } from "@/components/icons";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminHome(props: PageProps<"/admin">) {
  const me = await requireAdmin();
  const t = await getT();
  await releaseExpiredSuspensions();
  const [{ mfaOn }] = await db.select({ mfaOn: users.mfaEnabledAt }).from(users).where(eq(users.id, me.id)).limit(1);
  const sp = await props.searchParams;
  const code = typeof sp.notice === "string" ? sp.notice : "";
  const [op, cnt] = code.split(".");
  const notice =
    op === "approve" ? t("සිසුන් {n}ක් අනුමත කරන ලදී.", { n: cnt }) : op === "delete" ? t("සිසුන් {n}ක් ඉවත් කරන ලදී.", { n: cnt }) : code === "none" ? t("කිසිවෙකු තෝරා නැත.") : "";

  const [[{ reqCount }], statusRows, pending] = await Promise.all([
    db.select({ reqCount: count() }).from(changeRequests).where(eq(changeRequests.status, "PENDING")),
    db
      .select({ status: users.status, n: count() })
      .from(users)
      .where(eq(users.role, "STUDENT"))
      .groupBy(users.status),
    db
      .select({
        id: users.id,
        name: users.name,
        school: users.school,
        grade: users.grade,
        medium: users.medium,
        alYear: users.alYear,
        phone: users.phone,
        email: users.email,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        institute: institutes.name,
        avatarAt: userAvatars.updatedAt,
      })
      .from(users)
      .leftJoin(institutes, eq(institutes.id, users.instituteId))
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(eq(users.status, "PENDING"))
      .orderBy(desc(users.createdAt))
      .limit(50),
  ]);

  const n = (s: string) => statusRows.find((r) => r.status === s)?.n ?? 0;
  const total = n("ACTIVE") + n("PENDING") + n("SUSPENDED");
  const stats = [
    { label: t("මුළු සිසුන්"), value: total, icon: "users", tone: "blue", href: "/admin/students" },
    { label: t("සක්‍රිය"), value: n("ACTIVE"), icon: "check", tone: "green", href: "/admin/students?status=ACTIVE" },
    { label: t("අනුමැතිය බලාපොරොත්තුවෙන්"), value: n("PENDING"), icon: "inbox", tone: "sun", href: "/admin/students?status=PENDING" },
    { label: t("අත්හිටුවා ඇත"), value: n("SUSPENDED"), icon: "shield", tone: "red", href: "/admin/students?status=SUSPENDED" },
  ] as const;

  return (
    <div className="space-y-8">
      {!mfaOn && (
        <div role="note" data-testid="mfa-reminder" className="flex flex-wrap items-center gap-3 rounded-2xl border border-sun bg-sun-soft px-4 py-3 text-sm text-navy">
          <span className="flex-1">{t("ඔබගේ Admin ගිණුම 2-step verification මගින් ආරක්ෂා කර නැත. මුරපදය හොරකම් වුවහොත් පද්ධතිය අවදානමට ලක් වේ.")}</span>
          <Link href="/admin/account?tab=2step" className="inline-flex min-h-10 items-center rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-950">{t("දැන් සක්‍රිය කරන්න")}</Link>
        </div>
      )}
      <PageHero
        icon="home"
        title="Dashboard"
        subtitle={t("ආයුබෝවන්, {name}", { name: me.name })}
        badges={<HeroBadge tone="sun">{me.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</HeroBadge>}
      />
      <section>
        {notice && (
          <div role="status" className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {notice}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((st) => (
            <StatCard key={st.label} icon={st.icon} tone={st.tone} value={st.value} label={st.label} href={st.href} />
          ))}
        </div>
      </section>

      {reqCount > 0 && (
        <Link
          href="/admin/requests"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-sun-soft p-4 text-sm font-semibold text-amber-900 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sun text-navy"><Icon name="inbox" className="h-5 w-5" /></span>
          {t("අනුමැතිය බලාපොරොත්තුවෙන් වෙනස් කිරීමේ ඉල්ලීම් {n}ක් ඇත →", { n: reqCount })}
        </Link>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-navy">{t("අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්")}</h2>
          <Link href="/admin/students" className="text-sm font-semibold text-primary hover:underline">
            {t("සියලු සිසුන් →")}
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          {t("අනුමත කළ පසු, Email තහවුරු කර ඇති සිසුන්ට Login විය හැක.")}
        </p>

        {pending.length === 0 ? (
          <EmptyState>{t("අනුමැතිය බලාපොරොත්තුවෙන් කිසිවෙකු නැත.")}</EmptyState>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((s) => (
              <li key={s.id}>
                <ToneCard tone="sun" className="p-4 pt-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3.5">
                      <Avatar name={s.name} src={s.avatarAt ? avatarSrc(s.id, s.avatarAt) : null} />
                      <div className="min-w-0 space-y-1.5 text-sm">
                        <p className="text-base font-semibold text-navy">{s.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Chip tone="blue">{gradeLabel(s.grade, s.alYear, t)}</Chip>
                          {s.medium && <Chip tone="violet">{t(MEDIUM_LABELS[s.medium])}</Chip>}
                          <Chip tone="cyan" icon="building">{s.institute ?? t("ආයතනය නැත")}</Chip>
                          {s.emailVerified ? <Chip tone="green" icon="check">{t("Email තහවුරු කර ඇත")}</Chip> : <Chip tone="sun">{t("Email තවම තහවුරු කර නැත")}</Chip>}
                        </div>
                        <p className="text-muted">{s.school}</p>
                        <p className="break-all text-xs text-muted">
                          {s.email} · {s.phone}
                        </p>
                      </div>
                    </div>
                    <form className="flex shrink-0 gap-2">
                      <input type="hidden" name="returnTo" value="/admin" />
                      <button
                        type="submit"
                        formAction={studentOneAction.bind(null, "approve", s.id)}
                        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark"
                      >
                        {t("අනුමත කරන්න")}
                      </button>
                      <ConfirmButton
                        message={t("මෙම ලියාපදිංචිය ප්‍රතික්ෂේප කර සිසුවා මකා දමන්නද?")}
                        formAction={studentOneAction.bind(null, "delete", s.id)}
                        className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                      >
                        {t("ප්‍රතික්ෂේප")}
                      </ConfirmButton>
                    </form>
                  </div>
                </ToneCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

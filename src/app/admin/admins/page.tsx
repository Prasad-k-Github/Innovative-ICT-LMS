import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, inArray } from "drizzle-orm";
import { Avatar, Chip, ToneCard } from "@/components/cards";
import { Alert, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DATE_LOCALE } from "@/lib/i18n/core";
import { getLang, getT } from "@/lib/i18n/server";
import { requireSuperAdmin } from "@/lib/session";
import { PageHero, heroBtn } from "@/components/page-hero";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Admin ලා") };
}

const NOTICES: Record<string, string> = {
  deleted: "Admin ගිණුම මකා දමන ලදී.",
  gone: "Admin හමු නොවීය (ඉවත් කර ඇති විය හැක).",
};

export default async function AdminsPage(props: PageProps<"/admin/admins">) {
  await requireSuperAdmin();
  const t = await getT();
  const lang = await getLang();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : "";

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(inArray(users.role, ["SUPER_ADMIN", "ADMIN"]))
    .orderBy(asc(users.role), desc(users.createdAt));

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="shield"
        title={t("Admin ලා")}
        subtitle={t("ඔබට (Super Admin) සිසුන්, ආයතන සහ ඉල්ලීම් සම්බන්ධ සියලු දේ කළ හැක. මෙහිදී සහායක Admin ලා සාදා කළමනාකරණය කරන්න.")}
        actions={
          <Link href="/admin/admins/new" className={heroBtn}>
            {t("+ අලුත් Admin කෙනෙක්")}
          </Link>
        }
      />
      {notice && <Alert kind="success">{notice}</Alert>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((a) => (
          <li key={a.id}>
            <ToneCard tone={a.role === "SUPER_ADMIN" ? "blue" : "red"} className="h-full p-4 pt-5 text-sm">
              <div className="flex items-start gap-3">
                <Avatar name={a.name} tone={a.role === "SUPER_ADMIN" ? "blue" : "red"} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.role === "SUPER_ADMIN" ? (
                      <span className="text-base font-semibold text-navy">{a.name}</span>
                    ) : (
                      <Link href={`/admin/admins/${a.id}`} className="text-base font-semibold text-navy hover:text-primary hover:underline">
                        {a.name}
                      </Link>
                    )}
                    <Chip tone={a.role === "SUPER_ADMIN" ? "blue" : "red"} icon="shield">
                      {a.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                    </Chip>
                    <StatusBadge status={a.status} t={t} />
                  </div>
                  <p className="break-all text-muted">{a.email}</p>
                  <p className="text-xs text-muted">
                    {t("අවසන් Login")}: {a.lastLoginAt ? a.lastLoginAt.toLocaleString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo" }) : t("තවම නැත")}
                  </p>
                </div>
              </div>
            </ToneCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

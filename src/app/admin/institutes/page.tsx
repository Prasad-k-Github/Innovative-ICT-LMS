import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { createInstituteAction, deleteInstituteAction, renameInstituteAction } from "@/app/actions/admin";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert, inputClass } from "@/components/ui";
import { db } from "@/db";
import { institutes, users } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ආයතන") };
}

const NOTICES: Record<string, string> = {
  created: "ආයතනය එක් කරන ලදී.",
  renamed: "නම වෙනස් කරන ලදී.",
  deleted: "ආයතනය මකා දමන ලදී.",
};

export default async function InstitutesPage(props: PageProps<"/admin/institutes">) {
  await requireAdmin();
  const t = await getT();
  const sp = await props.searchParams;
  const notice = typeof sp.notice === "string" && NOTICES[sp.notice] ? t(NOTICES[sp.notice]) : undefined;
  const error = typeof sp.error === "string" ? t(sp.error.slice(0, 200)) : undefined;

  const rows = await db
    .select({ id: institutes.id, name: institutes.name, students: count(users.id) })
    .from(institutes)
    .leftJoin(users, eq(users.instituteId, institutes.id))
    .groupBy(institutes.id, institutes.name)
    .orderBy(asc(institutes.name));

  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold">{t("ආයතන")}</h1>
      <p className="text-sm text-muted">{t("සිසුන් ලියාපදිංචි වන විට තෝරන \"පැමිණෙන ආයතනය\" ලැයිස්තුව මෙතැනින් කළමනාකරණය කරන්න.")}</p>

      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <form action={createInstituteAction} className="flex gap-2 card p-4">
        <input name="name" required maxLength={100} placeholder={t("අලුත් ආයතනයේ නම")} aria-label={t("අලුත් ආයතනයේ නම")} className={inputClass} />
        <button type="submit" className={`${btn} shrink-0 bg-primary text-white hover:bg-primary-dark`}>
          {t("එක් කරන්න")}
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((i) => (
          <li key={i.id} className="card p-4">
            <form className="space-y-3">
              <input type="hidden" name="id" value={i.id} />
              <input name="name" defaultValue={i.name} required maxLength={100} aria-label={t("ආයතනයේ නම")} className={inputClass} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm text-muted">{t("සිසුන් {n}", { n: i.students })}</span>
                <button type="submit" formAction={renameInstituteAction} className={`${btn} border border-line bg-white hover:bg-slate-50`}>
                  {t("නම සුරකින්න")}
                </button>
                <ConfirmButton
                  message={t("\"{name}\" මකා දමන්නද?", { name: i.name })}
                  formAction={deleteInstituteAction}
                  className={`${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                >
                  {t("මකන්න")}
                </ConfirmButton>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

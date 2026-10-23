import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { createInstituteAction, deleteInstituteAction, renameInstituteAction } from "@/app/actions/admin";
import { Chip, Tile, ToneCard, toneAt } from "@/components/cards";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert, inputClass } from "@/components/ui";
import { db } from "@/db";
import { institutes, users } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { PageHero, PageTabs, pickTab, tabHref } from "@/components/page-hero";

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
    .select({ id: institutes.id, name: institutes.name, code: institutes.code, students: count(users.id) })
    .from(institutes)
    .leftJoin(users, eq(users.instituteId, institutes.id))
    .groupBy(institutes.id, institutes.name, institutes.code)
    .orderBy(asc(institutes.name));

  const btn = "min-h-11 rounded-xl px-4 text-sm font-semibold";

  const tab = pickTab(sp.tab, ["list", "add"]);
  const tabs = [
    { key: "list", label: t("ආයතන"), href: tabHref("/admin/institutes", "list", true), count: rows.length },
    { key: "add", label: t("අලුත් ආයතනයක්"), href: tabHref("/admin/institutes", "add", false) },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHero icon="building" title={t("ආයතන")} subtitle={t("සිසුන් ලියාපදිංචි වන විට තෝරන \"පැමිණෙන ආයතනය\" ලැයිස්තුව මෙතැනින් කළමනාකරණය කරන්න.")} />

      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "add" && (
        <form action={createInstituteAction} className="flex gap-2 card p-4">
          <input name="name" required minLength={2} maxLength={100} placeholder={t("අලුත් ආයතනයේ නම")} aria-label={t("අලුත් ආයතනයේ නම")} className={inputClass} />
          <input name="code" maxLength={6} placeholder={t("කේතය (හිස් නම් ස්වයංක්‍රීය)")} aria-label={t("ආයතන කේතය")} data-testid="institute-code-new" className={`${inputClass} uppercase sm:max-w-48`} />
          <button type="submit" className={`${btn} shrink-0 bg-primary text-white hover:bg-primary-dark`}>
            {t("එක් කරන්න")}
          </button>
        </form>

      )}
      {tab === "list" && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((i, idx) => (
            <li key={i.id}>
              <ToneCard tone={toneAt(idx)} className="p-4 pt-5">
              <form className="space-y-3">
                <div className="flex items-center gap-3">
                  <Tile icon="building" tone={toneAt(idx)} />
                  <Chip tone={toneAt(idx)} icon="users">{t("සිසුන් {n}", { n: i.students })}</Chip>
                </div>
                <input type="hidden" name="id" value={i.id} />
                <input name="name" defaultValue={i.name} required minLength={2} maxLength={100} aria-label={t("ආයතනයේ නම")} className={inputClass} />
                <label className="flex items-center gap-2 text-sm text-muted">
                  {t("Index කේතය")}
                  <input name="code" defaultValue={i.code} maxLength={6} aria-label={t("ආයතන කේතය")} data-testid="institute-code" className={`${inputClass} !w-28 uppercase`} />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto" />
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
              </ToneCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/profile-forms";
import { OwnNameForm } from "@/components/admin-user-form";
import { updateOwnNameAction } from "@/app/actions/super-admin";
import { SessionsCard, TwoStepCard } from "@/components/security-cards";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("මගේ ගිණුම") };
}

export default async function AdminAccountPage() {
  const me = await requireAdmin();
  const t = await getT();
  const lang = await getLang();
  const card = "space-y-4 card p-5";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-3xl font-bold">{t("මගේ ගිණුම")}</h1>

      <section className={card}>
        <h2 className="font-semibold">{t("මගේ විස්තර")}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">{t("Email ලිපිනය")}</dt>
          <dd className="break-all">{me.email}</dd>
          <dt className="text-muted">{t("භූමිකාව")}</dt>
          <dd>{me.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</dd>
        </dl>
        <hr className="border-line" />
        <OwnNameForm action={updateOwnNameAction} name={me.name} />
        {me.role !== "SUPER_ADMIN" && <p className="text-xs text-muted">{t("Email ලිපිනය වෙනස් කිරීමට Super Admin අමතන්න.")}</p>}
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t("මුරපදය වෙනස් කිරීම")}</h2>
        <ChangePasswordForm />
      </section>

      <TwoStepCard userId={me.id} email={me.email} t={t} />
      <SessionsCard userId={me.id} t={t} lang={lang} />
    </div>
  );
}

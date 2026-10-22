import type { Metadata } from "next";
import { AvatarForm } from "@/components/avatar-form";
import { avatarUrlOf } from "@/lib/avatar";
import { ChangePasswordForm } from "@/components/profile-forms";
import { OwnNameForm } from "@/components/admin-user-form";
import { updateOwnNameAction } from "@/app/actions/super-admin";
import { HeroBadge, PageHero, PageTabs, pickTab } from "@/components/page-hero";
import { SessionsCard, TwoStepCard } from "@/components/security-cards";
import { getLang, getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("මගේ ගිණුම") };
}

export default async function AdminAccountPage(props: PageProps<"/admin/account">) {
  const me = await requireAdmin();
  const sp = await props.searchParams;
  const t = await getT();
  const lang = await getLang();
  const avatar = await avatarUrlOf(me.id);
  const tab = pickTab(sp.tab, ["details", "password", "2step", "devices"]);
  const tabs = [
    { key: "details", label: t("මගේ විස්තර"), href: "/admin/account" },
    { key: "password", label: t("මුරපදය"), href: "/admin/account?tab=password" },
    { key: "2step", label: t("2-step verification"), href: "/admin/account?tab=2step" },
    { key: "devices", label: t("Devices"), href: "/admin/account?tab=devices" },
  ];
  const card = "space-y-4 card p-5 sm:p-6";

  return (
    <div className="w-full space-y-6">
      <PageHero
        icon="user"
        title={t("මගේ ගිණුම")}
        badges={
          <>
            <HeroBadge tone="sun">{me.name}</HeroBadge>
            <HeroBadge>{me.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</HeroBadge>
          </>
        }
      />

      <PageTabs tabs={tabs} active={tab} label={t("ගිණුම් කොටස්")} />

      {tab === "details" && (
      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("මගේ විස්තර")}</h2>
        <AvatarForm name={me.name} currentSrc={avatar} />
        <hr className="border-line" />
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
      )}

      {tab === "password" && (
      <section className={card}>
        <h2 className="font-display text-lg font-bold text-navy">{t("මුරපදය වෙනස් කිරීම")}</h2>
        <ChangePasswordForm />
      </section>
      )}

      {tab === "2step" && <TwoStepCard userId={me.id} email={me.email} t={t} />}
      {tab === "devices" && <SessionsCard userId={me.id} t={t} lang={lang} />}
    </div>
  );
}

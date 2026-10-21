import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert, btnSecondary } from "@/components/ui";
import { findValidToken } from "@/lib/auth-tokens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("නව මුරපදය") };
}
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const t = await getT();
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const valid = !!(await findValidToken(token, "RESET_PASSWORD"));

  if (!valid) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{t("Link එක වලංගු නැහැ")}</h1>
        <Alert kind="error">{t("මෙම link එක වලංගු නැත හෝ කල් ඉකුත් වී ඇත.")}</Alert>
        <Link href="/forgot-password" className={btnSecondary}>
          {t("අලුත් link එකක් ඉල්ලන්න")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("නව මුරපදය")}</h1>
      <p className="mb-6 text-sm text-muted">{t("ඔබගේ නව මුරපදය ඇතුළත් කරන්න.")}</p>
      <ResetPasswordForm token={token} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "@/components/auth-forms";
import { Alert, btnSecondary } from "@/components/ui";
import { findValidToken } from "@/lib/auth-tokens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("මුරපදය සාදන්න") };
}
export const dynamic = "force-dynamic";

// Email තහවුරු කළ පසු විවෘත වන වෙනම තිරය: සිසුවා තමාගේ මුරපදය සාදයි
export default async function SetPasswordPage(props: PageProps<"/set-password">) {
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
      <Alert kind="success">{t("Email ලිපිනය තහවුරු විය.")}</Alert>
      <h1 className="mb-1 mt-4 text-3xl font-bold">{t("මුරපදය සාදන්න")}</h1>
      <p className="mb-6 text-sm text-muted">{t("අවසන් පියවර: Login වීමට ඔබගේම මුරපදයක් සාදන්න.")}</p>
      <SetPasswordForm token={token} />
    </>
  );
}

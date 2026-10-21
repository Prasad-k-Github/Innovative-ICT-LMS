import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, btnSecondary } from "@/components/ui";
import { findValidToken } from "@/lib/auth-tokens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Email තහවුරු කිරීම") };
}
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const t = await getT();
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const valid = sp.error !== "1" && !!(await findValidToken(token, "VERIFY_EMAIL"));

  if (!valid) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{t("Link එක වලංගු නැහැ")}</h1>
        <Alert kind="error">
          {t("මෙම link එක වලංගු නැත, දැනටමත් භාවිතා කර ඇත, හෝ කල් ඉකුත් වී ඇත.")}
        </Alert>
        <Link href="/resend-verification" className={btnSecondary}>
          {t("අලුත් link එකක් ඉල්ලන්න")}
        </Link>
        <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
          {t("Login පිටුවට යන්න")}
        </Link>
      </div>
    );
  }

  // Email scanners link එක auto-open කරන නිසා, තහවුරු කිරීම බොත්තමකින් කරයි
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t("Email තහවුරු කරන්න")}</h1>
      <p className="text-sm text-muted">{t("ඔබගේ email ලිපිනය තහවුරු කිරීමට පහත බොත්තම ඔබන්න.")}</p>
      <form action={verifyEmailAction}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton pendingText="තහවුරු කරමින්...">{t("Email තහවුරු කරන්න")}</SubmitButton>
      </form>
    </div>
  );
}

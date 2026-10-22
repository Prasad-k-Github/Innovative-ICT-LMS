import type { Metadata } from "next";
import { EmailCodeForm } from "@/components/email-code-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Email තහවුරු කරන්න") };
}
export const dynamic = "force-dynamic";

// ලියාපදිංචි වූ පසු: email එකට ආ ඉලක්කම් 6ක code එක (විනාඩි 10ක් වලංගුයි) ඇතුළත් කරන තිරය
export default async function CheckEmailPage(props: PageProps<"/register/check-email">) {
  const t = await getT();
  const sp = await props.searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 150) : "";
  const exp = Number(typeof sp.exp === "string" ? sp.exp : "");
  // UI countdown සඳහා පමණි (වලංගු භාවය server එකේ DB එකෙන් තීරණය වේ)
  const initialExpiresAt = Number.isFinite(exp) && exp > 0 ? exp : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">{t("ඔබගේ email එක තහවුරු කරන්න")}</h1>
        <p className="mt-1 text-sm text-muted">{t("Email එකට ආ ඉලක්කම් 6ක code එක පහත ඇතුළත් කරන්න.")}</p>
      </div>
      <EmailCodeForm email={email} initialExpiresAt={initialExpiresAt} mailFailed={sp.mail === "failed"} />
    </div>
  );
}

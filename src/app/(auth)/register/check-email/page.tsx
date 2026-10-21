import type { Metadata } from "next";
import Link from "next/link";
import { Alert, btnSecondary } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Email පරීක්ෂා කරන්න") };
}

export default async function CheckEmailPage(props: PageProps<"/register/check-email">) {
  const t = await getT();
  const sp = await props.searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const mailFailed = sp.mail === "failed";

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t("ඔබගේ email එක පරීක්ෂා කරන්න")}</h1>

      {mailFailed ? (
        <Alert kind="warning">
          {t("ඔබගේ ගිණුම සාදන ලද නමුත් තහවුරු කිරීමේ email එක යැවීමට නොහැකි විය. පහත බොත්තමෙන් නැවත යවන්න.")}
        </Alert>
      ) : (
        <Alert kind="success">
          {t("තහවුරු කිරීමේ link එකක් මෙම email ලිපිනයට යවා ඇත:")} <strong className="break-all">{email}</strong>
        </Alert>
      )}

      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink">
        <li>{t("Email එකේ ඇති link එක ඔබා ඔබගේ email ලිපිනය තහවුරු කරන්න.")}</li>
        <li>{t("ඉන්පසු විවෘත වන තිරයේ ඔබගේ මුරපදය සාදන්න.")}</li>
        <li>{t("ඉන්පසු Admin ඔබගේ ගිණුම අනුමත කරයි.")}</li>
        <li>{t("අනුමත වූ පසු ඔබට Login විය හැක.")}</li>
      </ol>

      <p className="text-xs text-muted">{t("Email එක නොපෙනේ නම් Spam / Junk folder එක පරීක්ෂා කරන්න.")}</p>

      <Link href="/resend-verification" className={btnSecondary}>
        {t("Email එක නැවත යවන්න")}
      </Link>
      <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
        {t("Login පිටුවට යන්න")}
      </Link>
    </div>
  );
}

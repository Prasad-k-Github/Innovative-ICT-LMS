import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("මුරපදය අමතකද?") };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("මුරපදය අමතකද?")}</h1>
      <p className="mb-6 text-sm text-muted">
        {t("ලියාපදිංචි වූ email ලිපිනය ඇතුළත් කරන්න. මුරපදය වෙනස් කිරීමේ link එකක් අපි යවන්නෙමු.")}
      </p>
      <ForgotPasswordForm />
    </>
  );
}

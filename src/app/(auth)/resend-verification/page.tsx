import type { Metadata } from "next";
import { ResendVerificationForm } from "@/components/auth-forms";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Email එක නැවත යවන්න") };
}

export default async function ResendVerificationPage() {
  const t = await getT();
  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("තහවුරු කිරීමේ email එක")}</h1>
      <p className="mb-6 text-sm text-muted">
        {t("ලියාපදිංචි වූ email ලිපිනය ඇතුළත් කරන්න. අපි අලුත් තහවුරු කිරීමේ link එකක් යවන්නෙමු.")}
      </p>
      <ResendVerificationForm />
    </>
  );
}

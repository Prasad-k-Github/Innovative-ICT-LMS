import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, getPendingStudent } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Login") };
}
export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const t = await getT();
  const user = await getCurrentUser();
  if (user) redirect(user.role === "STUDENT" ? "/dashboard" : "/admin");
  if (await getPendingStudent()) redirect("/dashboard");

  const sp = await props.searchParams;
  const verified = sp.verified === "1";
  const reset = sp.reset === "1";
  const created = sp.created === "1";

  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("ආයුබෝවන්")}</h1>
      <p className="mb-6 text-sm text-muted">{t("ඔබගේ ගිණුමට පිවිසෙන්න")}</p>

      <div className="space-y-4">
        {verified && (
          <Alert kind="success">
            {t("Email ලිපිනය තහවුරු විය. Admin ඔබගේ ගිණුම අනුමත කළ පසු ඔබට login විය හැක.")}
          </Alert>
        )}
        {created && (
          <Alert kind="success">
            {t("මුරපදය සාදන ලදී. Login වී ඔබගේ ගිණුමේ තත්ත්වය බලන්න; Admin අනුමත කළ පසු පාඩම් විවෘත වේ.")}
          </Alert>
        )}
        {reset && <Alert kind="success">{t("මුරපදය වෙනස් කරන ලදී. අලුත් මුරපදයෙන් login වන්න.")}</Alert>}
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t("ගිණුමක් නැද්ද?")}{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t("ලියාපදිංචි වන්න")}
        </Link>
      </p>
    </>
  );
}

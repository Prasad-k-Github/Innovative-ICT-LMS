import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { RegisterForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("ලියාපදිංචි වන්න") };
}
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const t = await getT();
  const list = await db
    .select({ id: institutes.id, name: institutes.name })
    .from(institutes)
    .orderBy(asc(institutes.name));

  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("ලියාපදිංචි වන්න")}</h1>
      <p className="mb-6 text-sm text-muted">
        {t("පහත තොරතුරු පුරවන්න. Email තහවුරු කිරීමෙන් සහ Admin අනුමැතියෙන් පසු ඔබට පිවිසිය හැක.")}
      </p>

      {list.length === 0 ? (
        <Alert kind="warning">
          {t("ආයතන ලැයිස්තුව තවම සකසා නැත. කරුණාකර පසුව උත්සාහ කරන්න හෝ ආයතනය අමතන්න.")}
        </Alert>
      ) : (
        <RegisterForm institutes={list} />
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {t("දැනටමත් ගිණුමක් තිබේද?")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("Login වන්න")}
        </Link>
      </p>
    </>
  );
}

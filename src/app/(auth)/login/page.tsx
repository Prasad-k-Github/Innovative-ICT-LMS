import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { StaleSessionCleaner } from "@/components/stale-session-cleaner";
import { Alert } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { INDEX_RE } from "@/lib/validators";
import { getCurrentUser, getMfaPendingUser, getPendingStudent } from "@/lib/session";
import { parseReason, safeNext } from "@/lib/session-reason";

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
  if (await getMfaPendingUser()) redirect("/login/verify");

  const sp = await props.searchParams;
  const verified = sp.verified === "1";
  const reset = sp.reset === "1";
  const created = sp.created === "1";
  const idxRaw = typeof sp.idx === "string" ? sp.idx.toUpperCase() : "";
  const idx = INDEX_RE.test(idxRaw) ? idxRaw : "";
  const reason = parseReason(sp.reason);
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);

  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">{t("ආයුබෝවන්")}</h1>
      <p className="mb-6 text-sm text-muted">{t("ඔබගේ ගිණුමට පිවිසෙන්න")}</p>

      <div className="space-y-4">
        {reason && reason !== "logout" && <StaleSessionCleaner />}
        {reason === "logout" && <Alert kind="success">{t("සාර්ථකව logout විය.")}</Alert>}
        {reason === "idle" && <Alert kind="warning">{t("ටික වේලාවක් ක්‍රියාකාරී නොවූ නිසා ආරක්ෂාව සඳහා ඔබව ස්වයංක්‍රීයව logout කරන ලදී. නැවත login වන්න.")}</Alert>}
        {reason === "expired" && <Alert kind="warning">{t("ඔබේ session කාලය අවසන් විය. ආරක්ෂාව සඳහා නැවත login වන්න.")}</Alert>}
        {reason === "revoked" && (
          <Alert kind="warning">{t("ඔබේ session එක අවසන් කර ඇත (වෙනත් device එකකින් logout කිරීම, මුරපදය වෙනස් කිරීම හෝ devices සීමාව නිසා විය හැක). නැවත login වන්න.")}</Alert>
        )}
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
        {idx && (created || reset) && (
          <Alert kind="info">
            <span data-testid="login-index">
              {t("ඔබගේ Index අංකය")}: <strong className="font-mono tracking-wide">{idx}</strong>
            </span>
            <br />
            {t("එය ඔබගේ email එකට ද යවා ඇත. Login වීමට Index අංකය (හෝ email) සහ මුරපදය භාවිතා කරන්න.")}
          </Alert>
        )}
        <LoginForm next={next} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t("ගිණුමක් නැද්ද?")}{" "}
        <Link href="/register" className="inline-flex min-h-6 items-center font-semibold text-primary hover:underline">
          {t("ලියාපදිංචි වන්න")}
        </Link>
      </p>
    </>
  );
}

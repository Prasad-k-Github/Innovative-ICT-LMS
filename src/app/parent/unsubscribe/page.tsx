import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { parentUnsubscribeAction } from "@/app/actions/parent";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { verifyUnsubscribe } from "@/lib/parent-summary";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සාරාංශ ලැබීම නවත්වන්න") };
}

// දෙමාපියන් සඳහා: සතිපතා සාරාංශ Email ලැබීම නවත්වන පිටුව (තහවුරු කිරීමේ බොත්තමක් සමඟ; scanner bots වැරදීමකින් unsubscribe නොකරයි)
export default async function ParentUnsubscribePage(props: PageProps<"/parent/unsubscribe">) {
  const t = await getT();
  const sp = await props.searchParams;
  const u = typeof sp.u === "string" ? sp.u : "";
  const s = typeof sp.s === "string" ? sp.s : "";
  const valid = !!u && !!s && verifyUnsubscribe(u, s);
  const [row] = valid ? await db.select({ at: users.parentOptInAt }).from(users).where(eq(users.id, u)).limit(1) : [];
  const done = valid && !!row && row.at === null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">{t("සතිපතා සාරාංශ")}</h1>
      {!valid || !row ? (
        <p className="text-muted" data-testid="unsub-invalid">{t("මෙම link එක වලංගු නොවේ.")}</p>
      ) : done ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900" data-testid="unsub-done">{t("ඔබට තවත් සතිපතා සාරාංශ නොලැබේ.")}</p>
      ) : (
        <form action={parentUnsubscribeAction} className="space-y-4" data-testid="unsub-form">
          <p className="text-muted">{t("සතිපතා ප්‍රගති සාරාංශ Email ලැබීම නවත්වන්නද?")}</p>
          <input type="hidden" name="u" value={u} />
          <input type="hidden" name="s" value={s} />
          <button type="submit" className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-white hover:bg-primary-dark">
            {t("ඔව්, නවත්වන්න")}
          </button>
        </form>
      )}
    </main>
  );
}

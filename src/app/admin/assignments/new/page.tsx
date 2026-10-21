import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { createAssignmentAction } from "@/app/actions/assessment";
import { AssignmentForm } from "@/components/assessment-forms";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("අලුත් පැවරුමක්") };
}

export default async function NewAssignmentPage() {
  await requireAdmin();
  const t = await getT();
  const inst = await db.select({ id: institutes.id, name: institutes.name }).from(institutes).orderBy(asc(institutes.name));
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin/assignments" className="text-sm font-semibold text-primary hover:underline">
        ← {t("පැවරුම්")}
      </Link>
      <h1 className="text-3xl font-bold">{t("අලුත් පැවරුමක්")}</h1>
      <section className="card p-5">
        <AssignmentForm action={createAssignmentAction} institutes={inst} submitLabel={t("පැවරුම පවරන්න")} />
      </section>
    </div>
  );
}

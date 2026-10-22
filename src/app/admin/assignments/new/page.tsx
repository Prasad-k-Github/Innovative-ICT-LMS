import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { createAssignmentAction } from "@/app/actions/assessment";
import { AssignmentForm } from "@/components/assessment-forms";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { PageHero } from "@/components/page-hero";

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
    <div className="w-full space-y-6">
      <PageHero icon="clipboard" back={{ href: "/admin/assignments", label: t("පැවරුම්") }} title={t("අලුත් පැවරුමක්")} />
      <section className="card p-5 sm:p-6">
        <AssignmentForm action={createAssignmentAction} institutes={inst} submitLabel={t("පැවරුම පවරන්න")} />
      </section>
    </div>
  );
}

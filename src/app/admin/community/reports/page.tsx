import type { Metadata } from "next";
import { ReportsPage } from "@/components/community-pages";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සංවාද මණ්ඩපය") };
}

export default async function Page(props: PageProps<"/admin/community/reports">) {
  const user = await requireAdmin();
  return ReportsPage({ user, base: "/admin/community", isAdmin: true, sp: await props.searchParams });
}

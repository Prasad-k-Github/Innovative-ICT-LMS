import type { Metadata } from "next";
import { ThreadPage } from "@/components/community-pages";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සංවාද මණ්ඩපය") };
}

export default async function Page(props: PageProps<"/admin/community/[id]">) {
  const user = await requireAdmin();
  const { id } = await props.params;
  return ThreadPage({ user, base: "/admin/community", isAdmin: true, sp: await props.searchParams }, id);
}

import type { Metadata } from "next";
import { ForumIndex } from "@/components/community-pages";
import { getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("සංවාද මණ්ඩපය") };
}

export default async function Page(props: PageProps<"/dashboard/community">) {
  const user = await requireStudent();
  return ForumIndex({ user, base: "/dashboard/community", isAdmin: false, sp: await props.searchParams });
}

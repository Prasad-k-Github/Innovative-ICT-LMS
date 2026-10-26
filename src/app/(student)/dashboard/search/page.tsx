import { redirect } from "next/navigation";

// සෙවුම දැන් Dashboard එකේ (උසස් පෙරහන් සමඟ). පැරණි link වලට q පරාමිතිය රැගෙන යයි
export default async function LegacySearchPage(props: PageProps<"/dashboard/search">) {
  const sp = await props.searchParams;
  const out = new URLSearchParams();
  for (const k of ["q", "type", "sg", "year", "sort"]) {
    const v = Array.isArray(sp[k]) ? sp[k][0] : sp[k];
    if (typeof v === "string" && v) out.set(k, v.slice(0, 60));
  }
  redirect(`/dashboard${out.size ? `?${out}` : ""}#search`);
}

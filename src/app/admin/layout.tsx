import { AppShell, type ShellLink } from "@/components/app-shell";
import { ASSISTANT_PATH } from "@/lib/agent-config";
import { avatarUrlOf } from "@/lib/avatar";
import { dockConfigFor } from "@/lib/community";
import { getT } from "@/lib/i18n/server";
import { loadNotifications } from "@/lib/notifications-data";
import { requireAdminSetup } from "@/lib/session";

export const dynamic = "force-dynamic";

const LINKS: (ShellLink & { superOnly?: boolean })[] = [
  { href: "/admin", label: "Dashboard", icon: "home", exact: true },
  { href: "/admin/students", label: "සිසුන්", icon: "users" },
  { href: "/admin/progress", label: "ප්‍රගතිය", icon: "activity" },
  { href: "/admin/parents", label: "දෙමාපියන්", icon: "inbox" },
  { href: "/admin/lessons", label: "පාඩම්", icon: "book" },
  { href: "/admin/tutes", label: "Tutes", icon: "layers" },
  { href: "/admin/classes", label: "Online පන්ති", icon: "play" },
  { href: "/admin/newsletters", label: "පන්ති පුවත්පත්‍රිකා", icon: "papers" },
  { href: "/admin/community", label: "සංවාද මණ්ඩපය", icon: "chat" },
  { href: "/admin/testimonials", label: "අදහස් (Testimonials)", icon: "quote" },
  { href: "/admin/papers", label: "Papers සහ වෙනත්", icon: "papers" },
  { href: "/admin/assignments", label: "පැවරුම්", icon: "clipboard" },
  { href: "/admin/quizzes", label: "Quiz", icon: "quiz" },
  { href: "/admin/assistant", label: "AI සහායක", icon: "sparkle" },
  { href: "/admin/agent", label: "ICT මිතුරා පාලනය", icon: "chat" },
  { href: "/admin/requests", label: "ඉල්ලීම්", icon: "inbox" },
  { href: "/admin/institutes", label: "ආයතන", icon: "building" },
  { href: "/admin/admins", label: "Admin ලා", icon: "shield", superOnly: true },
  { href: "/admin/activity", label: "ක්‍රියා ඉතිහාසය", icon: "activity", superOnly: true },
  { href: "/admin/account", label: "මගේ ගිණුම", icon: "user" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Layout එක භූමිකාව පමණක් පරීක්ෂා කරයි; 2-step අනිවාර්ය බව එක් එක් පිටුව / action / download තමන්ම requireAdmin() මගින් බලයි (layout RSC navigation වලදී මඟ හැරිය හැකි නිසා)
  const admin = await requireAdminSetup();
  const isSuper = admin.role === "SUPER_ADMIN";
  const links: ShellLink[] = LINKS.filter((l) => !l.superOnly || isSuper).map((l) => ({ href: l.href, label: l.label, icon: l.icon, exact: l.exact }));

  const [notifications, avatarSrc] = await Promise.all([loadNotifications(admin.id, await getT()), avatarUrlOf(admin.id)]);

  return (
    <AppShell links={links} homeHref="/admin" badge={isSuper ? "Super Admin" : "Admin"} userName={admin.name} userIndex={admin.indexNo} avatarSrc={avatarSrc} notifications={notifications} chat={dockConfigFor(admin, await getT(), "/admin/community")} agentHref={ASSISTANT_PATH}>
      {children}
    </AppShell>
  );
}

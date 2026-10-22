import { AppShell, type ShellLink } from "@/components/app-shell";
import { avatarUrlOf } from "@/lib/avatar";
import { getT } from "@/lib/i18n/server";
import { loadNotifications } from "@/lib/notifications-data";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const LINKS: (ShellLink & { superOnly?: boolean })[] = [
  { href: "/admin", label: "Dashboard", icon: "home", exact: true },
  { href: "/admin/students", label: "සිසුන්", icon: "users" },
  { href: "/admin/lessons", label: "පාඩම්", icon: "book" },
  { href: "/admin/classes", label: "Online පන්ති", icon: "play" },
  { href: "/admin/papers", label: "Papers සහ වෙනත්", icon: "papers" },
  { href: "/admin/assignments", label: "පැවරුම්", icon: "clipboard" },
  { href: "/admin/quizzes", label: "Quiz", icon: "quiz" },
  { href: "/admin/agent", label: "ICT මිතුරා", icon: "chat" },
  { href: "/admin/requests", label: "ඉල්ලීම්", icon: "inbox" },
  { href: "/admin/institutes", label: "ආයතන", icon: "building" },
  { href: "/admin/admins", label: "Admin ලා", icon: "shield", superOnly: true },
  { href: "/admin/activity", label: "ක්‍රියා ඉතිහාසය", icon: "activity", superOnly: true },
  { href: "/admin/account", label: "මගේ ගිණුම", icon: "user" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const isSuper = admin.role === "SUPER_ADMIN";
  const links: ShellLink[] = LINKS.filter((l) => !l.superOnly || isSuper).map((l) => ({ href: l.href, label: l.label, icon: l.icon, exact: l.exact }));

  const [notifications, avatarSrc] = await Promise.all([loadNotifications(admin.id, await getT()), avatarUrlOf(admin.id)]);

  return (
    <AppShell links={links} homeHref="/admin" badge={isSuper ? "Super Admin" : "Admin"} userName={admin.name} avatarSrc={avatarSrc} notifications={notifications}>
      {children}
    </AppShell>
  );
}

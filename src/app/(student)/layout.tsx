import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell, type ShellLink } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { PendingNotice } from "@/components/pending-notice";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { dockConfigFor } from "@/lib/community";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { avatarUrlOf } from "@/lib/avatar";
import { getT } from "@/lib/i18n/server";
import { loadNotifications } from "@/lib/notifications-data";
import { getCurrentUser, getPendingStudent, toLogin } from "@/lib/session";

export const dynamic = "force-dynamic";

const LINKS: ShellLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", exact: true, also: ["/dashboard/lessons"] },
  { href: "/dashboard/assignments", label: "පැවරුම්", icon: "clipboard" },
  { href: "/dashboard/quizzes", label: "Quiz", icon: "quiz" },
  { href: "/dashboard/agent", label: "ICT මිතුරා", icon: "chat" },
  { href: "/dashboard/community", label: "සංවාද මණ්ඩපය", icon: "chat" },
  { href: "/dashboard/feedback", label: "මගේ අදහස", icon: "quote" },
  { href: "/dashboard/resources/past-papers", label: "Past Papers", icon: "papers", group: "අමතර අන්තර්ගතය" },
  { href: "/dashboard/resources/model-papers", label: "Model Papers", icon: "layers" },
  { href: "/dashboard/resources/recordings", label: "Recordings", icon: "play" },
  { href: "/dashboard/resources/notes", label: "අමතර Notes", icon: "book" },
  { href: "/dashboard/profile", label: "මගේ ගිණුම", icon: "user", group: "ගිණුම" },
];

export default async function StudentLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  const user = await getCurrentUser();

  if (!user) {
    // Email තහවුරු කර, Admin අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුවා: පණිවිඩය පමණක් පෙන්වයි (අන්තර්ගතය කිසිවක් නැත)
    const pending = await getPendingStudent();
    if (!pending) return toLogin();
    const [inst] = pending.instituteId
      ? await db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, pending.instituteId)).limit(1)
      : [];
    const rows = [
      { label: "ශ්‍රේණිය", value: gradeLabel(pending.grade, pending.alYear, t) },
      { label: "මාධ්‍යය", value: pending.medium ? t(MEDIUM_LABELS[pending.medium]) : "-" },
      { label: "පාසල", value: pending.school },
      { label: "පැමිණෙන ආයතනය", value: inst?.name ?? "-" },
      { label: "Email ලිපිනය", value: pending.email },
      { label: "දුරකතන අංකය", value: pending.phone },
    ];
    return (
      <AppShell links={[LINKS[0]]} homeHref="/dashboard" userName={pending.name} userSub={t("අනුමැතිය බලාපොරොත්තුවෙන්")} userIndex={pending.indexNo}>
        <AutoRefresh seconds={15} />
        <PendingNotice name={pending.name} rows={rows} t={t} />
      </AppShell>
    );
  }
  if (user.role !== "STUDENT") redirect("/admin");

  const [notifications, avatarSrc] = await Promise.all([loadNotifications(user.id, t), avatarUrlOf(user.id)]);

  return (
    <AppShell links={LINKS} homeHref="/dashboard" userName={user.name} userSub={gradeLabel(user.grade, user.alYear, t)} userIndex={user.indexNo} avatarSrc={avatarSrc} notifications={notifications} chat={dockConfigFor(user, t, "/dashboard/community")} agentHref="/dashboard/agent">
      {children}
    </AppShell>
  );
}

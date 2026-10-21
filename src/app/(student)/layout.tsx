import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell, type ShellLink } from "@/components/app-shell";
import { PendingNotice } from "@/components/pending-notice";
import { db } from "@/db";
import { institutes } from "@/db/schema";
import { MEDIUM_LABELS, gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser, getPendingStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

const LINKS: ShellLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", exact: true },
  { href: "/dashboard/assignments", label: "පැවරුම්", icon: "clipboard" },
  { href: "/dashboard/quizzes", label: "Quiz", icon: "quiz" },
  { href: "/dashboard/profile", label: "මගේ ගිණුම", icon: "user" },
];

export default async function StudentLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  const user = await getCurrentUser();

  if (!user) {
    // Email තහවුරු කර, Admin අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුවා: පණිවිඩය පමණක් පෙන්වයි (අන්තර්ගතය කිසිවක් නැත)
    const pending = await getPendingStudent();
    if (!pending) redirect("/login");
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
      <AppShell links={[LINKS[0]]} homeHref="/dashboard" userName={pending.name} userSub={t("අනුමැතිය බලාපොරොත්තුවෙන්")}>
        <PendingNotice name={pending.name} rows={rows} t={t} />
      </AppShell>
    );
  }
  if (user.role !== "STUDENT") redirect("/admin");

  return (
    <AppShell links={LINKS} homeHref="/dashboard" userName={user.name} userSub={gradeLabel(user.grade, user.alYear, t)}>
      {children}
    </AppShell>
  );
}

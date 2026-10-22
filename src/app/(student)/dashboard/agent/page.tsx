import type { Metadata } from "next";
import { AgentChat } from "@/components/agent-chat";
import { HeroBadge, PageHero } from "@/components/page-hero";
import { AGENT_NAME } from "@/lib/agent-config";
import { ensureWallet, hasActiveQuiz, loadConversation } from "@/lib/agent";
import { gradeLabel } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t(AGENT_NAME) };
}

// ශ්‍රේණිය අනුව ගැලපෙන ආරම්භක ප්‍රශ්න
function startersFor(grade: number): string[] {
  if (grade <= 7) return ["පරිගණකයක ප්‍රධාන කොටස් මොනවාද?", "Internet කියන්නේ මොකක්ද?", "Input සහ Output උපාංග අතර වෙනස මොකක්ද?"];
  if (grade <= 9) return ["RAM සහ Hard Disk අතර වෙනස මොකක්ද?", "Binary number එකක් කියන්නේ මොකක්ද?", "Algorithm එකක් කියන්නේ මොකක්ද?"];
  if (grade <= 11) return ["Database එකක primary key එකේ වැදගත්කම මොකක්ද?", "Network topology වර්ග පැහැදිලි කරන්න", "Flowchart එකක් අඳින්න පටන් ගන්නේ කොහොමද?"];
  return ["OSI model එකේ ස්ථර වල කාර්යභාරය මොනවාද?", "SQL JOIN වර්ග අතර වෙනස්කම් මොනවාද?", "Number system conversion කරන පියවර මොනවාද?"];
}

export default async function AgentPage() {
  const user = await requireStudent();
  const t = await getT();
  const wallet = await ensureWallet(user.id);
  const [quizActive, history] = await Promise.all([hasActiveQuiz(user.id), loadConversation(user.id, wallet.conversationId)]);
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  const locked = quizActive ? "quiz" : wallet.balance <= 0 ? "credits" : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHero
        icon="chat"
        title={t(AGENT_NAME)}
        subtitle={t("ICT ගැන ඔබේ ප්‍රශ්න අහන්න. පිළිතුරු සොයාගන්න මම මග පෙන්වන්නම් — ඔබත් එකට හිතමු!")}
        badges={<HeroBadge>{gradeLabel(user.grade, user.alYear, t)}</HeroBadge>}
      />
      <AgentChat
        initial={history.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        balance={wallet.balance}
        locked={locked}
        starters={startersFor(user.grade).map((s) => t(s))}
        firstName={first}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { AgentChat } from "@/components/agent-chat";
import { AGENT_NAME } from "@/lib/agent-config";
import { ensureWallet, hasActiveQuiz, loadConversation } from "@/lib/agent";
import { avatarUrlOf } from "@/lib/avatar";
import { getT } from "@/lib/i18n/server";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";
// Vercel: AI පිළිතුරක් (retry/fallback ඇතුළුව) තත්පර 60ක් දක්වා ගත විය හැක. Pro/Fluid plan හි 300 දක්වා ඉහළ දැමිය හැක.
export const maxDuration = 60;

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

// මුළු තිරයම ICT මිතුරාට (AppShell එක මෙම මාර්ගයේදී side panel + මෙය පමණක් පෙන්වයි)
export default async function AgentPage() {
  const user = await requireStudent();
  const t = await getT();
  const wallet = await ensureWallet(user.id);
  const [quizActive, history] = await Promise.all([hasActiveQuiz(user.id), loadConversation(user.id, wallet.conversationId)]);
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  const locked = quizActive ? "quiz" : wallet.balance <= 0 ? "credits" : null;

  return (
    <AgentChat
      initial={history}
      balance={wallet.balance}
      locked={locked}
      starters={startersFor(user.grade).map((s) => t(s))}
      firstName={first}
      userAvatar={await avatarUrlOf(user.id)}
    />
  );
}

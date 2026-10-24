import type { Metadata } from "next";
import { AgentChat } from "@/components/agent-chat";
import { ASSISTANT_NAME } from "@/lib/agent-config";
import { ensureWallet, loadConversation } from "@/lib/agent";
import { avatarUrlOf } from "@/lib/avatar";
import { getT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
// Vercel: AI පිළිතුරක් (retry/fallback ඇතුළුව) තත්පර 60ක් දක්වා ගත විය හැක. Pro/Fluid plan හි 300 දක්වා ඉහළ දැමිය හැක.
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t(ASSISTANT_NAME) };
}

// ගුරුතුමාගේ කටයුතු සඳහා ආරම්භක යෝජනා
const STARTERS = [
  "10 වසර ICT සඳහා 'Database' පාඩමට MCQ ප්‍රශ්න 10ක් පිළිතුරු සමඟ සාදන්න",
  "ඉදිරි සතියේ Online පන්තිය ගැන දෙමාපියන්ට යවන්න කෙටි දැන්වීමක් ලියන්න",
  "11 වසර 'Networking' පාඩමට පැය 1ක පාඩම් සැලසුමක් සකසන්න",
  "මෙම ප්‍රශ්නයට ශිෂ්‍යයෙකුට දිය හැකි යහපත් ප්‍රතිපෝෂණ comment එකක් ලියන්න",
];

// මුළු තිරයම AI සහායකයට (Admin ට පමණි; credits නැත, Quiz අගුල නැත)
export default async function AssistantPage() {
  const admin = await requireAdmin();
  const t = await getT();
  const wallet = await ensureWallet(admin.id);
  const history = await loadConversation(admin.id, wallet.conversationId);
  const first = admin.name.trim().split(/\s+/)[0] ?? admin.name;

  return <AgentChat mode="teacher" initial={history} balance={0} locked={null} starters={STARTERS.map((s) => t(s))} firstName={first} userAvatar={await avatarUrlOf(admin.id)} />;
}

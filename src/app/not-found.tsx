import { HomeLink, StatusScreen } from "@/components/status-screen";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return <StatusScreen code="404" title={t("පිටුව හමු නොවීය")} text={t("ඔබ සොයන පිටුව ඉවත් කර ඇති හෝ ලිපිනය වැරදි විය හැක.")} actions={<HomeLink label={t("මුල් පිටුවට යන්න")} />} />;
}

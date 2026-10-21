"use client";

import { HomeLink, StatusScreen } from "@/components/status-screen";
import { useT } from "@/components/i18n-provider";
import { btnGhostDark } from "@/components/ui";

export default function GlobalRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <StatusScreen
      code="500"
      title={t("යම් දෝෂයක් සිදු විය")}
      text={t("අපැහැදිලි දෝෂයක් නිසා මෙම පිටුව පූරණය කළ නොහැකි විය. නැවත උත්සාහ කරන්න.")}
      actions={
        <>
          <button type="button" onClick={reset} className={btnGhostDark}>
            {t("නැවත උත්සාහ කරන්න")}
          </button>
          <HomeLink label={t("මුල් පිටුවට යන්න")} />
        </>
      }
    />
  );
}

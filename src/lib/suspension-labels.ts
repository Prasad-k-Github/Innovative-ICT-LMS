import { SUSPEND_DAY_OPTIONS } from "./suspension-config";
import type { SuspensionLabels } from "@/components/suspension-fields";

export function suspensionLabels(t: (k: string, p?: Record<string, string | number>) => string): SuspensionLabels {
  return {
    duration: t("අත්හිටුවීමේ කාලය"),
    days: Object.fromEntries(SUSPEND_DAY_OPTIONS.map((d) => [d, t("දින {n}ක් (තාවකාලික)", { n: d })])),
    custom: t("තෝරාගත් දිනයක් දක්වා (තාවකාලික)"),
    permanent: t("ස්ථිරවම අත්හිටුවන්න"),
    until: t("අත්හිටුවීම අවසන් වන දිනය"),
    reason: t("අත්හිටුවීමේ හේතුව"),
    reasonPlaceholder: t("හේතුව (අවශ්‍ය නම්)"),
  };
}

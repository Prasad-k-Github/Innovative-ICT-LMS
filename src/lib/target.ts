import { MEDIUM_LABELS, gradeLabel } from "./constants";
import type { T } from "./i18n/core";

// "10 ශ්‍රේණිය · සිංහල මාධ්‍ය · Neth - Mapalagama" වැනි ඉලක්ක විස්තරය
export function targetLabel(
  x: { grade: number; medium: keyof typeof MEDIUM_LABELS; instituteName?: string | null },
  t: T,
) {
  return `${gradeLabel(x.grade, null, t)} · ${t(MEDIUM_LABELS[x.medium])} · ${x.instituteName ?? t("සියලු ආයතන")}`;
}

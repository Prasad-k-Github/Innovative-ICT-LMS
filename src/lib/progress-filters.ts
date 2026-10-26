import { GRADES, MEDIUMS } from "./constants";
import type { ProgressFilters } from "./progress";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// ?grade=10&medium=SINHALA&view=inactive (හිස්/වලංගු නොවේ නම් "සියල්ල")
export function parseProgressFilters(sp: SP): ProgressFilters & { view: "all" | "inactive" } {
  const g = Number(one(sp.grade));
  const m = one(sp.medium);
  const view = one(sp.view) === "inactive" ? "inactive" : "all";
  return {
    grade: (GRADES as readonly number[]).includes(g) ? g : null,
    medium: (MEDIUMS as readonly string[]).includes(m) ? (m as "SINHALA" | "ENGLISH") : null,
    inactiveOnly: view === "inactive",
    view,
  };
}

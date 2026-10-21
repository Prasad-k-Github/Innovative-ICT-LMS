import { GRADES, MEDIUMS } from "./constants";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// ?grade=10&medium=SINHALA (වලංගු නොවේ නම් 6 ශ්‍රේණිය / සිංහල)
export function parseScope(sp: SP) {
  const g = Number(one(sp.grade));
  const m = one(sp.medium);
  return {
    grade: (GRADES as readonly number[]).includes(g) ? g : GRADES[0],
    medium: ((MEDIUMS as readonly string[]).includes(m) ? m : MEDIUMS[0]) as (typeof MEDIUMS)[number],
  };
}

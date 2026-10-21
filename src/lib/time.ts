// Sri Lanka (Asia/Colombo, UTC+05:30, DST නැත). Admin ඇතුළත් කරන දින/වේලාවන් සැමවිටම ශ්‍රී ලංකා වේලාවෙන් අර්ථ දක්වයි.
const OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// "2026-10-25T14:30" (datetime-local) → Date (UTC instant). වලංගු නොවේ නම් null
export function parseColombo(input: string | null | undefined): Date | null {
  const m = LOCAL_RE.exec((input ?? "").trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS;
  const date = new Date(utc);
  // 2026-02-31 වැනි දින ප්‍රතික්ෂේප කරයි
  const back = new Date(utc + OFFSET_MS);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return date;
}

// Date → datetime-local input අගය (ශ්‍රී ලංකා වේලාවෙන්)
export function toColomboInput(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

export function formatColombo(d: Date | string | number, lang: "si" | "en" = "en"): string {
  void lang;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d));
}

// වත්මන් වේලාව (render අතරතුර Date.now() කෙලින්ම ඇමතීමෙන් වැළකීමට)
export const nowMs = () => Date.now();

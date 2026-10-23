// Session අවසන් වීමේ හේතු සහ login වූ පසු යන පිටුව (pure: server සහ client දෙකටම භාවිතා කළ හැක)

export const END_REASONS = ["idle", "expired", "revoked", "logout"] as const;
export type EndReason = (typeof END_REASONS)[number];

export function parseReason(v: unknown): EndReason | null {
  return typeof v === "string" && (END_REASONS as readonly string[]).includes(v) ? (v as EndReason) : null;
}

// Open-redirect වැළැක්වීමට: අපේම /dashboard හෝ /admin යටතේ ඇති සරල path එකක් පමණි
const NEXT_RE = /^\/(dashboard|admin)(\/[A-Za-z0-9._~\-%]+)*\/?$/;
export function safeNext(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 200 || v.includes("//") || v.includes("..") || v.includes("\\")) return null;
  return NEXT_RE.test(v) ? v : null;
}

export function loginUrl(reason?: EndReason | null, next?: string | null) {
  const q = new URLSearchParams();
  if (reason) q.set("reason", reason);
  const n = safeNext(next ?? null);
  if (n) q.set("next", n);
  const s = q.toString();
  return s ? `/login?${s}` : "/login";
}

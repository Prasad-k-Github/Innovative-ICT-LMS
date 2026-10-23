import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_HINT_COOKIE } from "@/lib/constants";
import { loginUrl } from "@/lib/session-reason";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy (සෑම request එකකටම අලුත් nonce එකක්):
// - script-src: 'unsafe-inline' ඉවත් කර ඇත. nonce සහිත scripts (Next.js විසින් ස්වයංක්‍රීයව යොදයි) සහ ඒවා පටවන scripts පමණක් ධාවනය වේ -> XSS මගින් script එකක් inject කළත් ධාවනය නොවේ
// - style-src: inline style attributes (React style={{}}) සඳහා 'unsafe-inline' තබා ඇත (style inject කිරීමෙන් code ධාවනය කළ නොහැක)
// - 'unsafe-eval' dev සඳහා පමණි
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://challenges.cloudflare.com${isDev ? " ws: wss:" : ""}`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// පළමු ආරක්ෂක ස්ථරය: session cookie එකක් නැතිනම් කෙලින්ම /login වෙත යවයි.
// සැබෑ පරීක්ෂාව (database session, role, status) layouts තුළ requireStudent() /
// requireAdmin() මගින් සෑම request එකකදීම සිදු වේ.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedArea = path === "/dashboard" || path.startsWith("/dashboard/") || path === "/admin" || path.startsWith("/admin/");
  if (protectedArea && !request.cookies.has(SESSION_COOKIE)) {
    // cookie එක ඉකුත් වී ඇත (කලින් login වී සිටි බව සලකුණෙන් පෙනේ): "session කල් ඉකුත් විය" පණිවිඩයක් සමඟ, සිටි පිටුවටම ආපසු එන්න
    const expired = request.cookies.has(SESSION_HINT_COOKIE);
    return NextResponse.redirect(new URL(loginUrl(expired ? "expired" : null, path), request.url));
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  // අවසර නැති ප්‍රවේශ උත්සාහ log කිරීමට (access.denied) path එක layouts වෙත යවයි
  const headers = new Headers(request.headers);
  headers.set("x-pathname", path);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // API, static files සහ prefetch requests හැර සියලු පිටු (CSP nonce සඳහා)
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

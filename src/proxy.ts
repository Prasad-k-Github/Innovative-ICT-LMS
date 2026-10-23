import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_HINT_COOKIE } from "@/lib/constants";
import { loginUrl } from "@/lib/session-reason";

// පළමු ආරක්ෂක ස්ථරය: session cookie එකක් නැතිනම් කෙලින්ම /login වෙත යවයි.
// සැබෑ පරීක්ෂාව (database session, role, status) layouts තුළ requireStudent() /
// requireAdmin() මගින් සෑම request එකකදීම සිදු වේ.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    // cookie එක ඉකුත් වී ඇත (කලින් login වී සිටි බව සලකුණෙන් පෙනේ): "session කල් ඉකුත් විය" පණිවිඩයක් සමඟ, සිටි පිටුවටම ආපසු එන්න
    const expired = request.cookies.has(SESSION_HINT_COOKIE);
    return NextResponse.redirect(new URL(loginUrl(expired ? "expired" : null, request.nextUrl.pathname), request.url));
  }
  // අවසර නැති ප්‍රවේශ උත්සාහ log කිරීමට (access.denied) path එක layouts වෙත යවයි
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

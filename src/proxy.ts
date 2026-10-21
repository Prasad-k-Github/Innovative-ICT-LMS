import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// පළමු ආරක්ෂක ස්ථරය: session cookie එකක් නැතිනම් කෙලින්ම /login වෙත යවයි.
// සැබෑ පරීක්ෂාව (database session, role, status) layouts තුළ requireStudent() /
// requireAdmin() මගින් සෑම request එකකදීම සිදු වේ.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  // අවසර නැති ප්‍රවේශ උත්සාහ log කිරීමට (access.denied) path එක layouts වෙත යවයි
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

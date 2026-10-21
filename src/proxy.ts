import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// පළමු ආරක්ෂක ස්ථරය: session cookie එකක් නැතිනම් කෙලින්ම /login වෙත යවයි.
// සැබෑ පරීක්ෂාව (database session, role, status) layouts තුළ requireStudent() /
// requireAdmin() මගින් සෑම request එකකදීම සිදු වේ.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ict_session")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

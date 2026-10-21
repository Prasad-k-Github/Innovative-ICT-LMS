"use client";

import { usePathname } from "next/navigation";

// ලියාපදිංචි පෝරමය පළල් තිරයේ තීරු දෙකකින් පෙන්වයි; අනෙක් පිටු (login, reset...) පටු තීරුවක
export function AuthContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/register";
  return <div className={`rise w-full ${wide ? "max-w-3xl" : "max-w-md"}`}>{children}</div>;
}

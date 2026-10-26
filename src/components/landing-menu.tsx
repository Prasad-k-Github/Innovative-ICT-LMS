"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icons";
import { useT } from "@/components/i18n-provider";

// කුඩා තිරවල (lg ට පහළ) landing හි ඉහළ මෙනුව hamburger එකක් ලෙස
export function LandingMenu({ items, homeHref }: { items: { href: string; label: string }[]; homeHref: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  const link = "flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-white/90 transition hover:bg-white/10";

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("මෙනුව වසන්න") : t("මෙනුව විවෘත කරන්න")}
        onClick={() => setOpen((v) => !v)}
        data-testid="landing-menu-button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sun"
      >
        <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label={t("ප්‍රධාන මෙනුව")}
          data-testid="landing-menu-panel"
          className="absolute inset-x-0 top-full border-b border-white/10 bg-navy-950 px-4 pb-4 pt-2 shadow-2xl backdrop-blur-xl"
        >
          <ul className="mx-auto max-w-md space-y-1">
            {items.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={close} className={link}>
                  {t(n.label)}
                </a>
              </li>
            ))}
            <li className="pt-2">
              {homeHref ? (
                <Link href={homeHref} onClick={close} className="flex min-h-12 items-center justify-center rounded-xl bg-sun px-5 text-base font-bold text-navy">
                  {t("Dashboard එකට යන්න")}
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" onClick={close} className="flex min-h-12 items-center justify-center rounded-xl bg-white/10 px-4 text-base font-semibold text-white ring-1 ring-white/20">
                    {t("Login වන්න")}
                  </Link>
                  <Link href="/register" onClick={close} className="flex min-h-12 items-center justify-center rounded-xl bg-sun px-4 text-base font-bold text-navy">
                    {t("ලියාපදිංචි වන්න")}
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

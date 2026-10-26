import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/ui";

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </div>
      <div className="flex-1 py-8">{children}</div>
    </main>
  );
}

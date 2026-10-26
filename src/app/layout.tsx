import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { PwaRegister } from "@/components/pwa-register";
import { getLang } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: { default: "Innovative ICT", template: "%s | Innovative ICT" },
    appleWebApp: { capable: true, title: "Innovative ICT", statusBarStyle: "black-translucent" },
    icons: { apple: "/apple-touch-icon.png" },
    description:
      lang === "en"
        ? "Innovative ICT - a simple, easy-to-use learning management system for ICT"
        : "Innovative ICT - ICT විෂය සඳහා සරල, පහසු ඉගෙනුම් කළමනාකරණ පද්ධතිය",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1633",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  // Browser extensions (උදා: crxlauncher) <html>/<body> වෙත attributes එකතු කරන නිසා hydration අනතුරු ඇඟවීම මෙහි පමණක් නිශ්ශබ්ද කරයි
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* App Router root layout හි මෙය නිවැරදියි (රීතිය Pages Router සඳහා පමණි) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+Sinhala:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        <I18nProvider lang={lang}>{children}</I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Logo, btnSun } from "./ui";

// 404 / දෝෂ පිටු සඳහා පොදු තිරය (navy පසුබිම, pixel grid, විශාල කේතය)
export function StatusScreen({ code, title, text, actions }: { code: string; title: string; text: string; actions?: ReactNode }) {
  return (
    <main className="pixel-grid relative flex min-h-dvh flex-col overflow-hidden bg-navy-950 text-white">
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-primary/30 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[360px] w-[360px] rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
      <header className="relative mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
        <Logo tone="dark" />
      </header>
      <section className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
        <p className="rise font-display text-[7rem] font-extrabold leading-none tracking-tight sm:text-[10rem]">
          <span className="bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">{code}</span>
        </p>
        <h1 className="rise mt-2 font-display text-3xl font-bold sm:text-4xl [animation-delay:80ms]">{title}</h1>
        <p className="rise mt-3 max-w-md text-lg leading-relaxed text-white/70 [animation-delay:140ms]">{text}</p>
        <div className="rise mt-8 flex flex-col gap-3 sm:flex-row [animation-delay:200ms]">{actions}</div>
      </section>
    </main>
  );
}

export function HomeLink({ label }: { label: string }) {
  return (
    <Link href="/" className={btnSun}>
      <Icon name="home" className="h-5 w-5" />
      {label}
    </Link>
  );
}

import type { ReactNode } from "react";

// සරල line icons (24x24, stroke 1.8). සෑම icon එකක්ම අලංකාරය සඳහා පමණි (aria-hidden)
const paths: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-5.5h4V20h5V9.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19.5c.6-3.3 3-5 6.2-5s5.6 1.7 6.2 5" />
      <path d="M16 5.2a3.1 3.1 0 0 1 0 5.8M18.2 14.8c1.7.7 2.7 2.2 3 4.7" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" transform="translate(0 -2)" />
      <path d="M9 8h7" />
    </>
  ),
  papers: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2.5" />
      <path d="M9 4.5V3.5h6v1M9 11h6M9 15h4" />
    </>
  ),
  quiz: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13.5 6 5h12l3 8.5" />
      <path d="M3 13.5V19a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5.5h-5.2a3 3 0 0 1-5.6 0z" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V4.5A1.5 1.5 0 0 1 5.5 3h8A1.5 1.5 0 0 1 15 4.5V21M15 9h3.5A1.5 1.5 0 0 1 20 10.5V21M2.5 21h19" />
      <path d="M8 7h3M8 11h3M8 15h3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6c0 4.6 3.1 7.6 7.5 9 4.4-1.4 7.5-4.4 7.5-9V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2.5-7 4 14 2.5-7H21" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  check: (
    <>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" transform="translate(0 -1.5)" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-8l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z" />
      <path d="M8 10h8M8 13h5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.3l-1.9-5.5L4.5 10.9 10.1 9z" />
      <path d="M19 3.5v3M17.5 5h3M5 17.5v3M3.5 19h3" />
    </>
  ),
  play: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m10.5 9.5 4 2.5-4 2.5z" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

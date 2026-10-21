"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Server component දත්ත විටින් විට නවීකරණය කරයි (tab එක පෙනෙන විට පමණි). අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුවා අනුමත වූ විගස dashboard වෙත යාමට
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && router.refresh();
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}

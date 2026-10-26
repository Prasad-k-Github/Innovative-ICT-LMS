"use client";

import { useEffect } from "react";

// Service worker ලියාපදිංචි කරයි (production හි පමණි; dev හි cache ගැටලු වළක්වයි)
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

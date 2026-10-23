"use client";

import { useEffect } from "react";
import { clearStaleSessionAction } from "@/app/actions/auth";

// Login පිටුවට session අවසන් වීමෙන් පසු පැමිණි විට: ඉකුත් වූ cookie එක browser එකෙන් ඉවත් කරයි (වලංගු session එකක් නම් කිසිවක් නොකරයි)
export function StaleSessionCleaner() {
  useEffect(() => {
    void clearStaleSessionAction().catch(() => {});
  }, []);
  return null;
}

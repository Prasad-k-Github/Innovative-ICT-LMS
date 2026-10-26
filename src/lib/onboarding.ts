import { randomInt } from "node:crypto";
import { PRIVACY_VERSION } from "./constants";

// සිසුවා පළමු login එකේදී සම්පූර්ණ කළ යුතු පියවර: (1) තමන්ගේ මුරපදය, (2) Email තහවුරු කිරීම, (3) එකඟත්වයන් සහ දෙමාපිය විස්තර.
// Production හි පෙරනිමියෙන් ක්‍රියාත්මකයි (REQUIRE_STUDENT_ONBOARDING=false මගින් අක්‍රිය කළ හැක; "true" මගින් ඕනෑම පරිසරයක බලාත්මක කරයි)
export type OnboardingStep = "password" | "email" | "consent";

export function onboardingEnabled(): boolean {
  const v = process.env.REQUIRE_STUDENT_ONBOARDING;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV === "production";
}

export type OnboardingFields = {
  role: string;
  mustChangePassword: boolean;
  emailConfirmedAt: Date | null;
  consentAt: Date | null;
  consentVersion: string | null;
  parentPhone: string | null;
  parentOptInAt: Date | null;
};

export function onboardingStep(u: OnboardingFields): OnboardingStep | null {
  if (!onboardingEnabled() || u.role !== "STUDENT") return null;
  if (u.mustChangePassword) return "password";
  if (!u.emailConfirmedAt) return "email";
  if (!u.consentAt || u.consentVersion !== PRIVACY_VERSION || !u.parentPhone || !u.parentOptInAt) return "consent";
  return null;
}

export const ONBOARDING_ORDER: OnboardingStep[] = ["password", "email", "consent"];

// තාවකාලික මුරපදය: දින 14ක් වලංගුයි
export const TEMP_PASSWORD_DAYS = 14;

// කියවීමට පහසු අකුරු (0/O, 1/l/I වැනි ව්‍යාකූල ඒවා නැත). අකුරු සහ ඉලක්කම් දෙකම අඩංගු වේ
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
export function generateTempPassword(len = 10): string {
  const all = LETTERS + DIGITS;
  const chars = Array.from({ length: len }, () => all[randomInt(all.length)]);
  chars[randomInt(len)] = LETTERS[randomInt(LETTERS.length)];
  if (!chars.some((c) => /\d/.test(c))) chars[randomInt(len)] = DIGITS[randomInt(DIGITS.length)];
  if (!chars.some((c) => /[A-Za-z]/.test(c))) chars[0] = LETTERS[randomInt(LETTERS.length)];
  return chars.join("");
}

export const tempPasswordExpiry = (now = Date.now()) => new Date(now + TEMP_PASSWORD_DAYS * 86_400_000);

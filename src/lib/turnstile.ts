import "server-only";

// Cloudflare Turnstile (bot ආරක්ෂාව). TURNSTILE_SECRET_KEY සහ NEXT_PUBLIC_TURNSTILE_SITE_KEY දෙකම සකසා ඇත්නම් පමණක් සක්‍රීය වේ
// (නැතිනම් -- local development සහ tests -- නිවැරදි ලෙස අක්‍රීයව පවතී).
export function turnstileEnabled() {
  return !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

export const CAPTCHA_MESSAGE = "ආරක්ෂක පරීක්ෂාව (මම රොබෝවරයෙක් නොවේ) සම්පූර්ණ කර නැවත උත්සාහ කරන්න.";

// Cloudflare හි siteverify මගින් token එක තහවුරු කරයි. අක්‍රීය නම් සැමවිටම true. Cloudflare වෙත ළඟා විය නොහැකි නම් අසාර්ථක (fail closed)
export async function verifyTurnstile(formData: FormData, ip: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    // TURNSTILE_VERIFY_URL (test mock) production හිදී නොසලකයි
    const url = process.env.NODE_ENV !== "production" && process.env.TURNSTILE_VERIFY_URL ? process.env.TURNSTILE_VERIFY_URL : "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const res = await fetch(url, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("turnstile verify failed", e);
    return false;
  }
}

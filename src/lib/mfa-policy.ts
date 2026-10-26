// Admin ගිණුම් සඳහා 2-step verification අනිවාර්යද? Production හි පෙරනිමියෙන් ඔව්.
// REQUIRE_ADMIN_MFA=true: ඕනෑම පරිසරයක අනිවාර්ය කරයි; REQUIRE_ADMIN_MFA=false: Production හිදීත් අක්‍රිය කරයි (නිර්දේශ නොකරයි)
export function adminMfaRequired(): boolean {
  const v = process.env.REQUIRE_ADMIN_MFA;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV === "production";
}

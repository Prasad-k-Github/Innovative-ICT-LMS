# ආරක්ෂාව (Innovative ICT)

## ස්වයං සමාලෝචනය (මා විසින් කළ දේ)
- **Access control:** `npm run check:authz`: සෑම server action එකක්ම භූමිකාව පරීක්ෂා කරයි (CI හි ස්වයංක්‍රීයව). Admin පිටු/downloads/API සියල්ල `requireAdmin` / `isAdminUser` හරහා.
- **Admin 2-step (TOTP) අනිවාර්යයි** (Production පෙරනිමිය; `REQUIRE_ADMIN_MFA`). සකස් කරන තෙක් Admin ට "මගේ ගිණුම" පමණි.
- **Sessions:** Admin කෙටි (පැය 12 / අක්‍රිය විනාඩි 60), cookie HttpOnly, 2-step නොකළ session එකකින් කිසිවක් කළ නොහැක.
- **මුරපද:** scrypt hash; rate limits; lockout; Turnstile (විකල්ප).
- **Audit log:** hash-chain (tamper-evident), Super Admin ට verify කළ හැක.
- **CSP:** nonce-based, `strict-dynamic`; security headers (`X-Frame-Options`, COOP, CORP ...).
- **CSV:** formula injection neutralised. Import: ප්‍රමාණ/පේළි සීමා, preview පසු confirm.
- **Privacy:** සිසුවාට තම දත්ත JSON ලෙස බාගත හැක (`/api/me/export`), ගිණුම මැකිය හැක; දෙමාපිය දුරකතනය අනිවාර්ය + සතිපතා සාරාංශය දැනුම් දීම පිළිගැනීම (දිනය සහිතව, වෙනම checkbox එකකින්); Email සාරාංශවල HMAC unsubscribe. සිසුන් පළමු login එකේදී මුරපදය, Email code සහ එකඟත්වය සම්පූර්ණ කළ යුතුයි (`REQUIRE_STUDENT_ONBOARDING`); Admin ජනනය කරන තාවකාලික මුරපද hash ලෙස පමණක් ගබඩා වේ (දින 14).
- **Cron:** `CRON_SECRET` නැතිනම් 503, වැරදි නම් 401 (constant-time compare).
- **පිරිවැය පාලනය:** Sage දෛනික/සමස්ත/මාසික සීමා.
- **CI:** push/PR සෑම එකකටම tsc, eslint, i18n, authz, migrate, build, smoke. **Dependabot** සතිපතා.

## ඔබ (ගුරුතුමා) කළ යුතු දේ: ස්වාධීන පරීක්ෂණය
මම මගේම කේතය පරීක්ෂා කළ නිසා මෙය **ස්වාධීන penetration test එකක් නොවේ.** සැබෑ සිසුන් දත්ත සමඟ launch කිරීමට පෙර:
1. පළපුරුදු ආරක්ෂක පරීක්ෂකයෙකුට (හෝ ආයතනයකට) staging පරිසරයක් ලබා දී ඔවුන්ට පරීක්ෂා කිරීමට ඉඩ දෙන්න.
2. පරීක්ෂණ විෂය පථය: login/2-step/session, භූමිකා අතර ප්‍රවේශ (සිසුවා → Admin, සිසුවා → වෙනත් සිසුවා), file upload/download, CSV import, API routes (`/api/*`), rate limits, CSP.
3. සොයාගැනීම් ලැබුණු පසු විසඳා, නැවත පරීක්ෂා කරවන්න.
4. GitHub හි **Settings → Code security**: Dependabot alerts, secret scanning සක්‍රිය කරන්න.
5. ආරක්ෂක ගැටලුවක් වාර්තා කිරීමට ඔබේ email එකක් `/privacy` හෝ වෙබ් අඩවියේ සඳහන් කරන්න.

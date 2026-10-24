# Innovative ICT

ICT විෂය සඳහා සරල LMS එකක්. **Next.js (App Router) + TypeScript + PostgreSQL + Drizzle ORM + Tailwind CSS**.

මෙම අදියරේ ඇතුළත්: ව්‍යාපෘති සැකසුම, database schema, ලියාපදිංචිය (Email verification + මුරපදය සාදා ගැනීම + Admin අනුමැතිය),
Login / Logout / මුරපදය අමතකවීම, Student සහ Admin shells, Admin ට ලියාපදිංචි සිසුන් අනුමත/ප්‍රතික්ෂේප කිරීම.

## 1. ආරම්භ කිරීම

```bash
npm install
cp .env.example .env.local     # ඉන්පසු .env.local පුරවන්න (පහත 2 කොටස බලන්න)
npm run db:migrate             # tables සාදයි
npm run db:seed                # පළමු Admin + ආයතන ලැයිස්තුව සාදයි
npm run dev                    # http://localhost:3000
```

## 2. .env.local පුරවන ආකාරය

| විචල්‍යය | කොහෙන්ද |
|---|---|
| `DATABASE_URL` | [Neon](https://neon.tech) (නොමිලේ) හෝ Supabase හි PostgreSQL connection string එක |
| `APP_URL` | Website URL එක (Email වල link සඳහා). Local: `http://localhost:3000` |
| `ALLOWED_DEV_ORIGINS` | (Dev පමණි) `localhost` නොවන ලිපිනයකින් (උදා: `192.168.56.1`) විවෘත කරන්නේ නම් එම host කොමාවෙන් වෙන් කර දෙන්න; නැතිනම් බොත්තම්/forms ක්‍රියා නොකරයි. පහසුම ක්‍රමය: `http://localhost:3000` භාවිතා කිරීම |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail ගිණුමේ **2-Step Verification** ON කර, Google Account → Security → **App passwords** වලින් මුරපදයක් සාදන්න. සාමාන්‍ය Gmail මුරපදය ක්‍රියා නොකරයි |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO` | (විකල්ප, production සඳහා නිර්දේශිතයි) ඔබේම domain එකකින් SMTP සේවාවක්. සකසා ඇත්නම් Gmail වෙනුවට මෙය භාවිතා වේ. [DEPLOY.md](DEPLOY.md) හි "Email spam folder එකට යාම" බලන්න |
| `APP_SECRET` | අඩු තරමින් අක්ෂර 32ක random රහස් අගයක් (`openssl rand -base64 48`). 2-step secrets සංකේතනයට සහ audit log hash chain එකට භාවිතා වේ. **Production හිදී අනිවාර්යයි; වෙනස් කළොත් Admin ලාගේ 2-step ක්‍රියා නොකරයි (reset කිරීමට සිදුවේ) සහ audit chain තහවුරු නොවේ - ආරක්ෂිතව backup කරන්න** |
| `ANTHROPIC_API_KEY` | ICT මිතුරා (AI) සඳහා. [console.anthropic.com](https://console.anthropic.com) → API keys. නැතිව dev වලදී demo පිළිතුරු පෙන්වයි; **Production වලදී නැත්නම් ICT මිතුරා සක්‍රිය නොවේ**. key එක workspace එකකට scope වී නැත්නම් `ANTHROPIC_WORKSPACE_ID` ද අවශ්‍යයි (නැත්නම් "not scoped to a workspace" 400 error එක එයි). විකල්ප: `AGENT_MODEL` (පෙරනිමි `claude-haiku-5-5`), `AGENT_FREE_CREDITS` (පෙරනිමි 40) |
| `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL` | ICT මිතුරා සඳහා **Google Gemini** භාවිතා කිරීමට: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) හි key එක `GEMINI_API_KEY` ලෙස දී (අවශ්‍ය නම් `AI_PROVIDER=gemini`) දෙන්න. `GEMINI_MODEL` පෙරනිමි `gemini-3.8-flash`. දෙකම ඇත්නම් `AI_PROVIDER` මගින් තෝරයි (නැත්නම් Anthropic). **සැලකිය යුතුයි:** Google ගේ free tier එකේ දත්ත ඔවුන්ගේ නිෂ්පාදන වැඩිදියුණු කිරීමට භාවිතා වේ (සිසුන් ළමයින් නිසා paid tier නිර්දේශිතයි), සහ free tier හි rate limits ඇත |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ `S3_ENDPOINT`, `S3_REGION`) | (විකල්ප, නමුත් **Production සඳහා නිර්දේශිතයි**) පැවරුම් files, profile ඡායාරූප සහ ICT මිතුරාට යැවූ files Postgres වෙනුවට **private** S3-ගැළපෙන bucket එකක ගබඩා කරයි - උදා: [Cloudflare R2](https://developers.cloudflare.com/r2/) (නොමිලේ 10GB; `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`), AWS S3, Backblaze B2. Bucket එක **public නොකරන්න**. විස්තර: "Files ගබඩාව" කොටස |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | (විකල්ප, නිර්දේශිතයි) [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) (නොමිලේ) widget එකක් සාදා keys දෙක දෙන්න. ලියාපදිංචියේදී bot පරීක්ෂාවක්, සහ ගිණුමකට වැරදි login 6ක් ඉක්මවූ විට login වලදීත් පෙන්වයි. keys නැතිනම් අක්‍රීයයි |
| `GEMINI_FALLBACK_MODEL` | (විකල්ප) Gemini හි ප්‍රධාන model එක "high demand" (503) / rate limit (429) නිසා අසාර්ථක වුවහොත් අත්හදා බලන ඊළඟ model එක (උදා: ලාභ Flash-Lite වර්ගයක්). ඊට පෙර ප්‍රධාන model එකම backoff සහිතව (1s, 2.5s) 2 වතාවක් නැවත උත්සාහ කරයි; `ANTHROPIC_API_KEY` ද සකසා ඇත්නම් අවසානයේ එයද භාවිතා කරයි (පිළිතුරු දෙන්නේ කුමන provider එකෙන් වුවත් සිසුවාට පෙනෙන්නේ එකමයි). සියල්ල අසාර්ථක නම් friendly පණිවිඩයක් පෙන්වා credits ආපසු දෙයි |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | පළමු Admin ගිණුම (seed වලදී පමණක් භාවිතා වේ, අවම අක්ෂර 10). ආයතන 5 (පන්ති ස්ථාන) `src/lib/constants.ts` මගින් seed වේ |

**Development වලදී** Gmail keys නැතිව වුවද වැඩ කරයි: Email එක යවනවා වෙනුවට terminal එකේ (console) link එක
පෙන්වයි. **Production වලදී** Gmail keys අනිවාර්යයි (නැත්නම් Email යැවෙන්නේ නැත).

### Files ගබඩාව සහ backups (Production)

**Files (private bucket)**
1. [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2) (හෝ S3 / B2) හි bucket එකක් සාදන්න (**Public access OFF**). R2 නම් **Object Read & Write** අවසර ඇති API token එකක් සාදා Access Key ID / Secret ගන්න.
2. `.env.local` / Vercel env හි `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION` දෙන්න, ඉන්පසු `npm run db:migrate` (migration `0021` මගින් `storage_key` තීරු එක් වේ).
3. දැනටමත් Postgres හි ඇති files bucket එකට ගෙන යාමට: `npm run storage:migrate` (එක් එක් file එකේ SHA-256 තහවුරු කර, ඉන්පසු Postgres දත්ත ඉවත් කරයි; නැවත ධාවනය කිරීම ආරක්ෂිතයි).
4. සියලු downloads තවමත් අවසර + SHA-256 integrity පරීක්ෂාවෙන් පසු **මෙම server හරහා පමණි**; bucket URL පරිශීලකයාට කිසිවිටක් නොදෙයි. Bucket එක නොපැමිණීම / දෝෂ සඳහා 503 ලබා දෙයි (crash නොවේ).
5. පරිශීලකයෙකු / පැවරුමක් මැකූ විට ඉතිරි වන objects ඉවත් කිරීමට (මාසිකව): `npm run storage:gc -- --dry` (බලන්න) ඉන්පසු `npm run storage:gc`. පැය 24ට වඩා පැරණි, කිසිදු row එකකින් යොමු නොකෙරෙන objects පමණක් ඉවත් කරයි.

**Backups (අනිවාර්යයි - ඔබ අතින් සක්‍රීය කළ යුතුයි)**
- **Neon (database)**: Console → Project → Settings → *Storage / Restore window* හි **point-in-time restore** (history retention) කාලය ඔබගේ සැලසුම ඉඩ දෙන උපරිමයට සකසන්න (සැලසුම අනුව වෙනස් වේ; Neon හි වත්මන් සීමා පරීක්ෂා කරන්න). එම කාලය කෙටි නම් **සතිපතා `pg_dump`** එකක් ගෙන ආරක්ෂිත තැනක (Google Drive / R2 වෙනත් bucket) තබන්න: `pg_dump "$DATABASE_URL" -Fc -f ict-$(date +%F).dump`.
- **Bucket**: R2/S3 හි **Object versioning** සහ (අවශ්‍ය නම්) lifecycle rule එකක් සක්‍රීය කරන්න; එවිට අහම්බෙන් මැකූ files ආපසු ලබාගත හැක.
- **`APP_SECRET`** ආරක්ෂිතව වෙනම ස්ථානයක (password manager) backup කරන්න (නැතිවුවහොත් Admin 2-step සහ audit chain තහවුරු නොවේ).
- **Restore පරීක්ෂාව**: සෑම මාසයකම backup එකක් වෙනම Neon branch එකකට restore කර `/api/health` සහ login සාර්ථකදැයි බලන්න; නැතිනම් backup එක ඇත්තටම ක්‍රියා කරන බව ඔබ නොදනී.

## 3. පද්ධතිය ක්‍රියා කරන ආකාරය

1. සිසුවා ලියාපදිංචි වේ (නම, පාසල, ශ්‍රේණිය, **මාධ්‍යය (සිංහල/English)**, දුරකතනය, Email, ආයතනය). මුරපදයක් **නැත**
2. Email එකට ගිය link එකෙන් Email තහවුරු කරයි
3. තහවුරු වූ විගස විවෘත වන **වෙනම තිරයක** (`/set-password`) තමාගේ **මුරපදය සාදයි** (link එක පැය 24ක් වලංගුයි; කල් ඉකුත් වුවහොත් "මුරපදය අමතකද?" භාවිතා කරන්න)
4. මුරපදය සාදා ඇති නිසා **Login විය හැක**. නමුත් Admin අනුමත කරන තුරු dashboard හි පෙනෙන්නේ "**අනුමැතිය බලාපොරොත්තුවෙන්**" පණිවිඩය සහ ඔහු ලබා දුන් තොරතුරු පමණි (පාඩම්, පැවරුම්, Quiz, files කිසිවක් විවෘත නොවේ)
5. **Admin** (`/admin`) ඔහුව **අනුමත** කළ විගස, නැවත login නොවී එම session එකෙන්ම සම්පූර්ණ dashboard එක විවෘත වේ

ගිණුම් තත්ත්ව: `PENDING` (අනුමතය බලාපොරොත්තුවෙන්) → `ACTIVE` → `SUSPENDED` (තාවකාලිකව අත්හිටුවා ඇත).

**මාධ්‍යය:** සිසුන්, පාඩම් (`lessons`) සහ resources (papers, recordings, notes) සියල්ලටම `medium` ක්ෂේත්‍රයක් ඇත. අදියර 4/5 හිදී
සිසුවාගේ **ශ්‍රේණිය + මාධ්‍යය** ගැළපෙන content පමණක් පෙන්වයි.

Landing page හි ගුරුවරයාගේ නම/හැඳින්වීම සහ පන්ති ස්ථාන `src/lib/constants.ts` හි (`TEACHER`, `CLASS_LOCATIONS`) සංස්කරණය කළ හැක.

**උසස් පෙළ (A/L):** ශ්‍රේණි 12 සහ 13 වෙන් නොකරයි. ලියාපදිංචියේදී "උසස් පෙළ" තෝරා **විභාගය පැවැත්වෙන වර්ෂය** ලබා දෙයි (database හි `grade = 12`, `al_year`). A/L පාඩම් 14 (ICT නිර්දේශයේ ඒකක) එකම ලැයිස්තුවකි.

**පාඩම්:** `npm run db:seed` මගින් ශ්‍රේණි 6 - 11 සහ A/L පාඩම් (අධ්‍යාපන ප්‍රකාශන දෙපාර්තමේන්තුවේ කියවීම් පොත් වල පරිච්ඡේද, සිංහල සහ
English දෙමාධ්‍යයටම, මුළු 108ක්: ශ්‍රේණි 6-11 සඳහා 80ක් + A/L සඳහා 28ක්) ඇතුළත් වේ (`src/db/curriculum.ts`). නැවත run කළත් අනුපිටපත් නොසැදේ.  A/L හි සිංහල නම් පරිවර්තන නිසා Admin Panel එකෙන් ඔබේ වචන වලට සංස්කරණය කරන්න.

## 4. ආරක්ෂාව

- මුරපද **bcrypt** වලින් hash කර ඇත. Admin ට සිසුන්ගේ මුරපද බැලීමට/වෙනස් කිරීමට ක්‍රමයක් නැත
- **Database sessions**: සෑම request එකකදීම status පරීක්ෂා කරන නිසා, suspend/delete කළ විගස ප්‍රවේශය නැති වේ
- Session / email / reset tokens database එකේ ගබඩා වන්නේ **hash** ලෙසය
- **Rate limiting (database-backed)**: login, ලියාපදිංචිය, මුරපද reset, email යැවීම, file උඩුගත කිරීම සඳහා. Serverless instances කිහිපයක් අතරද නිවැරදිව ක්‍රියා කරයි (`rate_limits` table). Login හි IP සීමාව ගණන් වන්නේ අසාර්ථක උත්සාහයන් පමණි
- Email ලියාපදිංචි දැයි හෙළි නොවන පිළිතුරු (forgot password / resend)
- සෑම Server Action එකකම role පරීක්ෂාව ඇත (`requireAdmin` / `requireSuperAdmin` / `requireStudent`). `npm run check:authz` මගින් ස්වයංක්‍රීයව සත්‍යාපනය කළ හැක
- **Admin / Super Admin මුරපද අවම අක්ෂර 10**; `.env.local` හි ADMIN_PASSWORD placeholder එකක් නම් seed ප්‍රතික්ෂේප කරයි
- **Security headers**: CSP (`default-src 'self'`, Google Fonts පමණක් අවසර), HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP
- **Open-redirect** වැළැක්වීම (`returnTo` සත්‍යාපනය), කල් ඉකුත් වූ sessions/tokens ස්වයංක්‍රීයව ඉවත් කිරීම
- **උඩුගත කළ files**: extension allowlist + magic-byte පරීක්ෂාව, ප්‍රමාණ සීමා, authenticated `/api/files/[id]` හරහා පමණක් බාගත කිරීම (attachment, nosniff, CSP sandbox)
- **Quiz**: නිවැරදි පිළිතුරු quiz වසන තෙක් browser එකට නොයවයි; ලකුණු server එකේම ගණනය කරයි

### Session සහ Cookie කළමනාකරණය
- **Session කාල**: සිසුන් — ක්‍රියාකාරී නොවී දින 3ක් / login වී දින 7ක්; Admin ලා — ක්‍රියාකාරී නොවී විනාඩි 60ක් / පැය 12ක් (`src/lib/constants.ts`). එකවර සක්‍රිය devices සීමාව: සිසුන් 8, Admin ලා 5 (පැරණිතම ඉවත් වේ; audit log හි `session.limit`).
- **Session cookie**: `__Host-ict_session` (production) — HttpOnly, Secure, SameSite=Lax, path=/, `maxAge` සහිත; token එක DB හි ඇත්තේ hash ලෙස පමණි. Login / 2-step / මුරපදය වෙනස් කිරීමේදී token අලුත් වේ (session fixation වැළැක්වීම).
- **ඉකුත්වීමේ හේතු**: session අවසන් වූ විට `/login?reason=idle|expired|revoked` ට යවා පැහැදිලි පණිවිඩයක් පෙන්වයි (`logout` සඳහා සාර්ථක පණිවිඩයක්). ඉකුත් වූ cookie එක browser එකෙන් ඉවත් කරයි. Login වූ පසු **සිටි පිටුවටම** ආපසු යයි (`next` — `/dashboard`/`/admin` යටතේ සරල path එකක් නම් පමණි; `//`, `..`, බාහිර URL ප්‍රතික්ෂේප).
- **පසුබිම් polling ≠ ක්‍රියාකාරිත්වය**: chat / දැනුම්දීම් / session පරීක්ෂාව idle කාලය දිගු නොකරයි (`getCurrentUser(false)`), එබැවින් tab එකක් විවෘතව තැබීමෙන් Admin session එක අවසන් නොවී පවතින්නේ නැත. පරිශීලක ක්‍රියාකාරිත්වය (click / type / scroll) විනාඩි 1½කට වරක් `/api/session/keepalive` (CSRF: අභිරුචි header + Origin පරීක්ෂාව) මගින් idle කාලය නැවත ආරම්භ කරයි.
- **SessionGuard (browser)**: ඉතිරි කාලය `/api/session` මගින් කියවයි; idle logout එකට තත්පර 120කට පෙර (උපරිම කාලයට තත්පර 300කට පෙර) countdown සහිත අනතුරු ඇඟවීමක් ("දිගටම සිටින්න" / Logout) පෙන්වයි; අවසන් වූ විට හෝ වෙනත් device එකකින් අවසන් කළ විට (විනාඩියක් ඇතුළත) login වෙත යවයි; tab එකට ආපසු ආවිට වහාම පරීක්ෂා කරයි.
- **Session දිගු කිරීමේ window**: idle logout එකට තත්පර 120කට පෙර modal එකක් (තත්පර ගණන් කිරීමත් සමඟ) පෙන්වයි. "දිගටම සිටින්න" ඔබන විට **මුරපදය** (2-step සක්‍රිය නම් **Authenticator code** ද) තහවුරු කළ යුතුයි; තහවුරු වන තෙක් idle කාලය දිගු නොවේ; වැරදි උත්සාහ rate limit වේ; `session.extend` ලෙස audit වේ. උපරිම (absolute) කාලය කිසිවිටෙක දිගු නොවේ.
- **සක්‍රිය sessions** (මගේ ගිණුම): device, IP, login වූ වේලාව, අවසන් භාවිතය, කල් ඉකුත් වන වේලාව; එකක් හෝ අනෙක් සියල්ල අවසන් කළ හැක.
- **Cookies පිටුව** `/cookies`: භාවිතා කරන cookies (`ict_session`, `ict_hs`, `ict_next`, `ict_lang`) සහ localStorage සැකසුම්, session නීති. අත්‍යවශ්‍ය cookies පමණි (tracking නැත) නිසා අනුමැති banner නැත.

### තහවුරු කිරීමේ කවුළු (confirmation)
- බ්‍රවුසරයේ "localhost says" `confirm()` වෙනුවට අපගේම කවුළුව (`ConfirmDialog` / `ConfirmButton`): Esc හෝ පිටත ඔබා අවලංගු කළ හැක, Tab focus කවුළුව තුළම රැඳේ, පෙරනිමි focus "අවලංගු කරන්න" මත (අහම්බෙන් Enter ඔබා මැකීම වැළැක්වීමට), mobile හිදී පහළින් නැගී එයි.
- **සදහටම මකන විට සත්‍යාපනය**: සිසුවෙකු / Admin කෙනෙකු මකන විට ඔහුගේ නම ටයිප් කළ යුතුයි; තෝරාගත් සිසුන් කිහිප දෙනෙකු එකවර මකන විට තෝරාගත් ගණන පෙන්වා "මකන්න" ටයිප් කළ යුතුයි. කිසිවෙකු තෝරා නැතිනම් කවුළුවක් නොපෙන්වා පණිවිඩයක් පෙන්වයි.

### සිසුන් අත්හිටුවීම (තාවකාලික / ස්ථිර)
- Admin ට සිසුවෙකු (හෝ තෝරාගත් සිසුන්) **දින 1 / 3 / 7 / 14 / 30ක්**, **තෝරාගත් දිනයක් දක්වා (ශ්‍රී ලංකා වේලාවෙන් එම දිනය අවසන් වන තෙක්)** හෝ **ස්ථිරවම** අත්හිටුවිය හැක; අවශ්‍ය නම් හේතුවක්ද සටහන් කරයි (සිසුවාගේ විස්තර පිටුවේ පෝරමය, හෝ සිසුන් ලැයිස්තුවේ bulk තීරුව).
- අත්හිටුවූ විගස සියලු devices වල sessions අවසන් වේ. දැනටමත් අත්හිටුවා ඇති සිසුවෙකුගේ කාලය / හේතුව වෙනස් කළ හැක (`students.suspended_until` NULL = ස්ථිර).
- Login කිරීමේදී (මුරපදය නිවැරදි නම්) සිසුවාට අවසන් වන දිනය සහ හේතුව පෙනේ. තාවකාලික අත්හිටුවීම කාලය ඉකුත් වූ පසු **ස්වයංක්‍රීයව** අවසන් වේ (login කරන විට, හෝ Admin dashboard / සිසුන්ගේ පිටු බලන විට; `student.auto_activate` ලෙස audit වී සිසුවාට දැනුම්දීමක් යයි).
- සිසුන් ලැයිස්තුවේ "තාවකාලික" / "ස්ථිර" filter සහ badge; migration `0019_student_suspension` (`npm run db:migrate`).

### Index අංක (සිසුන් සහ Admin ලා)
- ආකෘතිය: `<ආයතන කේතය>-S-<වර්ෂය>-<අනුක්‍රමික අංකය>` (සිසුන්; උදා `PU-S-2026-0007`) සහ `ICT-A-<වර්ෂය>-<අංකය>` (Admin ලා). වර්ෂය = ලියාපදිංචි වූ වර්ෂය (ශ්‍රී ලංකා වේලාවෙන්). අංකය ආයතනය + වර්ෂය අනුව 0001 සිට; Postgres trigger එකකින් (`next_user_index`) ස්වයංක්‍රීයව, එකම අංකය දෙවරක් නොදෙන පරිදි (atomic counter). පවතින සියලු ගිණුම් වලට migration `0020_user_index_numbers` මගින් backfill වේ.
- **ආයතන කේතය** (`institutes.code`, අකුරු/ඉලක්කම් 2-6): ආයතනය සාදන විට හිස් නම් නමෙන් ස්වයංක්‍රීයව සෑදේ; Admin ආයතන පිටුවෙන් වෙනස් කළ හැක. අද්විතීයයි; `ICT` Admin ලාට වෙන්කර ඇත. කේතය වෙනස් කළත් පරණ ගිණුම් වල Index අංක වෙනස් නොවේ.
- **Login**: Email **හෝ** Index අංකය + මුරපදය. Index අංකය ලොකු/පොඩි අකුරු සහ හිස්තැන් නොසලකයි. වැරදි පිළිතුර සෑම විටම එකම පණිවිඩයක් (ගිණුමක් ඇත්දැයි හෙළි නොකරයි); වැරදි උත්සාහ ගණන ගිණුමේ email එකට ගණන් ගන්නා නිසා Index සහ email දෙකෙන්ම උත්සාහ කර සීමාව මග හැරිය නොහැක. Index අංකය username එකක් පමණයි, හිමිකම තහවුරු වන්නේ මුරපදයෙනි.
- **දැනුම් දීම**: (1) ලියාපදිංචි වූ සැණින් check-email පිටුවේ සහ තහවුරු කිරීමේ email එකේ, (2) ලියාපදිංචිය අවසන් වූ පසු (මුරපදය සාදා ගත් විට) Index අංකය සහිත විශේෂ email එකක් සිංහල + English දෙකෙන්ම සහ login පිටුවේ පණිවිඩයක්, (3) Admin / Admin සාදන ලද ගිණුම් පළමු වරට මුරපදය සකසන විටත් එම email එකම යයි (නැවත මුරපදය වෙනස් කරන පරණ පරිශීලකයන්ට නොයයි), (4) side bar, profile, Admin පිටු වල සැමවිටම පෙනේ. සිසුන් / Admin ලා Index අංකයෙන් සෙවිය හැක; සිසුන්ගේ CSV export එකේ පළමු තීරුව Index අංකයයි.

### Profile ඡායාරූප පෙන්වීම (රහස්‍යතා නීති)
- ඡායාරූපය උඩුගත කර ඇත්නම් chat, ප්‍රජාව (forum), ICT මිතුරා / AI සහායක, Admin පිටු (සිසුන්, Admin ලා, ඉල්ලීම්, Activity, ඉදිරිපත් කිරීම්, Quiz ප්‍රතිඵල, සාක්ෂි) සහ පිටු ශීර්ෂ (hero) වල පෙන්වයි; නැතිනම් නමේ මුල් අකුරු.
- **Admin ලා** සියලු දෙනාගේ ඡායාරූප දකී; **සෑම කෙනෙක්ම** තමාගේ ඡායාරූපය දකී; **සිසුන්** දකින්නේ ගුරුවරුන්ගේ / Admin ලාගේ ඡායාරූප පමණි. **සිසුවෙකුගේ ඡායාරූපය අනෙක් සිසුන්ට නොපෙන්වයි** (බොහෝ දෙනා ළමයින් නිසා).
- Landing page හි අදහස් (testimonials) වල ඡායාරූප නොපෙන්වයි. මෙම නීති `canSeeAvatar()` (`src/lib/avatar.ts`) සහ `/api/avatar/[id]` හි server පැත්තෙන්ම බලාත්මක වේ.

### AAA සහ CIA

**Authentication (සත්‍යාපනය)**
- Admin / Super Admin ට **2-step verification (TOTP, RFC 6238)**: Google Authenticator වැනි app එකකින්. Secret එක AES-256-GCM ලෙස සංකේතනය කර ඇත; recovery codes 8ක් hash ලෙස පමණක් ගබඩා වේ; එකම code එක නැවත භාවිතා කිරීම (replay) වළක්වයි. Admin ගිණුම් > "මගේ ගිණුම" වෙතින් සක්‍රිය කරන්න (Admin dashboard හි මතක් කිරීමක් පෙන්වයි)
- මුරපද policy: අවම දිග, සාමාන්‍ය/පහසුවෙන් අනුමාන කළ හැකි මුරපද (`password123`, `student123` ආදිය) ප්‍රතික්ෂේප කරයි
- Login rate limit + තාවකාලික අගුල, 2-step code උත්සාහ සඳහා වෙනම rate limit

**Authorization (අවසරය)**
- Role-based (STUDENT / ADMIN / SUPER_ADMIN), සෑම Server Action එකකම පරීක්ෂාව (`npm run check:authz`)
- අවසර නැති ප්‍රවේශ උත්සාහයන් `access.denied` ලෙස audit log හි සටහන් වේ
- Files: හිමිකරුට සහ Admin ට පමණි

**Accounting (වගවීම)**
- Audit log: කවුද, කුමක්ද, කවදාද, **IP සහ device** සමඟ; login / logout / අසාර්ථක උත්සාහ / 2-step / session / file බාගැනීම් ද ඇතුළුව
- **Tamper-evident**: සෑම සටහනක්ම `APP_SECRET` සමඟ HMAC hash chain එකකට සම්බන්ධයි. Super Admin ට Activity පිටුවේ "Log integrity" මගින් තහවුරු කළ හැක; සටහනක් වෙනස් කිරීම/මැකීම හඳුනාගනී
- Sessions: තමාගේ active devices බලා, තනි එකක් හෝ අනෙක් සියල්ල අවසන් කළ හැක

**Confidentiality (රහස්‍යභාවය)**
- bcrypt මුරපද, hash කළ tokens, සංකේතනය කළ 2-step secrets, `__Host-` session cookie (production), authenticated pages සඳහා `Cache-Control: no-store`, CORP/COOP/CSP headers

**Integrity (අඛණ්ඩතාව)**
- උඩුගත කළ files වල **SHA-256** ගබඩා කර බාගත කරන විට නැවත පරීක්ෂා කරයි (නොගැළපුවහොත් ලබා නොදී `file.integrity_failure` සටහන් වේ)
- Audit hash chain, Zod validation, server-side quiz ලකුණු

**Availability (ලබාගත හැකි බව)**
- API සහ file endpoints සඳහා rate limits, `/api/health` (database ping; monitoring සඳහා), Session idle/absolute කාල සීමා (Admin: පැය 12 / විනාඩි 60 idle; සිසු: දින 7 / දින 3 idle)
- Neon backups / point-in-time recovery සක්‍රීය කරන්න

### දන්නා / පිළිගත් අවදානම් සහ නිර්දේශ

- ලියාපදිංචියේදී "email එක දැනටමත් ඇත" යැයි පෙන්වයි (email enumeration) - rate limit මගින් අඩු කර ඇත. **reCAPTCHA ඉවත් කර ඇති නිසා** bot ලියාපදිංචි වීම් වැළැක්වෙන්නේ rate limit (IP එකකට විනාඩි 10කට 20), Email තහවුරු කිරීම සහ Admin අනුමැතිය මගින් පමණි. Spam වැඩි වුවහොත් Cloudflare Turnstile වැනි එකක් පසුව එක් කළ හැක
- **Login අගුලු දැමීම (lockout abuse නැති)**: අසාර්ථක login 6ක් (ගිණුම + IP යුගලයට) විනාඩි 10ක් ඒ IP එකට පමණක් අගුලු දමයි, ගිණුමේ හිමිකරුට වෙනත් IP එකකින් login විය හැක. ගිණුමට සියලු IP වලින් 6ක් ඉක්මවූ විට Turnstile (සකසා ඇත්නම්) අවශ්‍ය වේ; 40ක් ඉක්මවූ විට (බෙදාහැරි brute force) විනාඩි 10ක් සියල්ලන්ටම අගුලු වේ
- **Bot ලියාපදිංචි වීම්**: Turnstile keys සකසා ඇත්නම් ලියාපදිංචි පෝරමයේ bot පරීක්ෂාවක් (server පැත්තෙන් තහවුරු කරයි), ඊට අමතරව rate limit, Email තහවුරු කිරීම, Admin අනුමැතිය
- CSP: `script-src` සඳහා **nonce + strict-dynamic** භාවිතා වේ (`'unsafe-inline'` නැත; `src/proxy.ts`), එබැවින් inject කළ inline script / `onerror=` ධාවනය නොවේ. `style-src` හි පමණක් `'unsafe-inline'` ඇත (React inline style attributes සඳහා)
- Audit log හි **අග කොටස ඉවත් කිරීම** (tail truncation) hash chain මගින් හඳුනාගත නොහැක; Neon backups සමඟ බලන්න
- Authenticator app නැති වී recovery codes ද නැති Admin කෙනෙකුගේ 2-step reset කළ හැක්කේ Super Admin ට (Admin → Admin ලා → reset). Super Admin ගේම එක නැති වුවහොත් database හරහා අතින් reset කළ යුතුය
- Files (පැවරුම් / ඡායාරූප / ICT මිතුරා) පෙරනිමියෙන් Postgres හි; production සඳහා `S3_*` සකසා private bucket එකකට මාරු කරන්න ("Files ගබඩාව" කොටස)
- Production හිදී **Neon backups / point-in-time recovery** සක්‍රීය කරන්න
- `npm audit --omit=dev` : දුර්වලතා 0

### පරීක්ෂා කළ ප්‍රතිඵල (Production build, CPU 2ක sandbox, AI mock කර ඇත)
- **බර (load)**: සිසුන් 100-150ක් එකවර පිටු පරිශීලනය කරන විට (තත්පරයට ඉල්ලීම් ~50-75) errors 0, p95 ≈ 50-90ms; විනාඩි 7ක soak (ඉල්ලීම් 20,000+) සහ ඉන්පසු තවත් ඉල්ලීම් 9,000ක් පසුවත් memory ≈ 455MB හි ස්ථාවරයි (leak නැත). ("Dev server 4-5GB" වුණේ `next dev` හි පමණි.)
- **එකවර login (පන්තිය ආරම්භයේදී)**: මුරපද hashing bcryptjs (CPU එක අවහිර කරන) වෙනුවට Node හි native **scrypt** (thread pool එකේ) බවට මාරු කළා; පැරණි bcrypt hashes සාර්ථක login එකකදී ස්වයංක්‍රීයව උත්ශ්‍රේණි වේ. සිසුන් 40ක් එකවර login වන විට (CPU 2ක) සියල්ලම ~7s තුළ අවසන් වූ අතර, එම කාලයේ අනෙක් ඉල්ලීම් (`/api/health`) උපරිම 131ms. Vercel හි instance කිහිපයකට විහිදෙන නිසා එය වඩා වේගවත් වේ.
- **Accessibility**: axe-core (WCAG 2.2 A/AA + best-practice) පිටු 40ක් (desktop + mobile; anon / සිසු / Admin) violations 0. 320 - 768px පළල 5කදී පිටු 21ක horizontal overflow නැත; සියලු ක්‍රියාකාරී අංග ≥ 24x24px; keyboard Tab සහ focus indicator ඇත.
- **ආරක්ෂණ self-audit**: `.env`/`.git`/source/maps නිරාවරණය නැත, unauthenticated API/පිටු ආරක්ෂිතයි, headers (HSTS, CSP nonce, ...), session cookie (`__Host-`, HttpOnly, Secure, SameSite=Lax, DB හි hash පමණි), cross-origin server action සහ open-redirect අවහිර; `npm audit --omit=dev` = 0.
- **තවමත් කළ නොහැකි / ඔබ කළ යුතු**: සැබෑ iPhone/Android + Safari පරීක්ෂාව (මෙහි Chromium emulation පමණි), සැබෑ AI key සමඟ බර පරීක්ෂාව, සහ **වෘත්තීය ආරක්ෂණ විගණනයක් (penetration test)**; ඒ සඳහා අවම වශයෙන් Vercel preview URL එකක් අරභයා OWASP ZAP baseline scan එකක් ධාවනය කර ප්‍රතිඵල සමාලෝචනය කරන්න.

## Design (UI)

- වර්ණ: navy (`#0b1633`), logo නිල් (`#0a5cc2`), logo රතු (`#e60008`) සහ ගුරුවරයාගේ ඡායාරූපයෙන් ගත් කහ (`sun`). සියල්ල `src/app/globals.css` හි `@theme` තුළ
- අකුරු: Bricolage Grotesque (මාතෘකා), Plus Jakarta Sans (සාමාන්‍ය), Noto Sans Sinhala (සිංහල)
- රාමුව: විශාල තිරයේ වම් sidebar, දුරකථනයේ menu drawer (`src/components/app-shell.tsx`). Login/ලියාපදිංචි පිටු split-screen (`src/app/(auth)/layout.tsx`)
- දිගු පිටු (ගිණුම, පාඩම/quiz/පැවරුම/සිසු විස්තර ආදිය) **tab බොත්තම්** වලට බෙදා ඇත (`?tab=` URL, `PageTabs` in `src/components/page-hero.tsx`) — එකම දිගු පිටුවක් නොවේ
- සිසුන්ගේ sidebar හි "අමතර අන්තර්ගතය" (Past/Model papers ආදිය) සහ "ගිණුම" කොටස් ඇත; පාඩමට පහළින් නොපෙන්වයි (`/dashboard/resources/[type]`)
- විචිත්‍ර cards: `src/components/cards.tsx` (`ToneCard`, `Tile`, `Avatar`, `Chip`, `StatCard`) — වර්ණ gradient ඉර, gradient icon කොටු, chips; තත්ත්වය/වර්ගය අනුව වර්ණ (ලැයිස්තු, stat, අන්තර්ගත files සඳහා)
- පොදු `card` ශ්‍රේණිය, `btnPrimary`/`btnSun` සහ අනෙක් primitives `ui.tsx` හි

## Validation (Client + Server)

- **Server (අනිවාර්ය)**: සෑම action එකක්ම Zod schemas (`src/lib/validators.ts`) මගින් දත්ත පරීක්ෂා කරයි. Client එක මග හැරිය හැකි නිසා server එකම අවසාන තීරණය ගනී (JS අක්‍රිය කළත් ක්‍රියා කරයි).
- **Client (ඉක්මන් ප්‍රතිචාර)**: එම schemas ම browser එකේද ධාවනය වේ (`src/components/use-form-validation.ts`): submit කරන විට වැරදි ඇත්නම් server එකට නොයවා ක්ෂේත්‍ර අසල පෙන්වයි, පළමු වැරදි ක්ෂේත්‍රයට focus කරයි; blur වන විට සහ නිවැරදි කරන විට ඒ ක්ෂේත්‍රය යාවත්කාලීන වේ. පණිවිඩ භාෂාව අනුව පරිවර්තනය වේ.
- Zod හි default ඉංග්‍රීසි පණිවිඩ `z.config({ customError })` මගින් අපගේ පණිවිඩ වලින් ප්‍රතිස්ථාපනය කර ඇත.

## 5. Scripts

| Command | කාර්යය |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / run |
| `npm run typecheck` | TypeScript පරීක්ෂාව |
| `npm run db:generate` | `src/db/schema.ts` වෙනස් කළ පසු නව migration සාදයි |
| `npm run db:migrate` | Migrations apply කරයි |
| `npm run db:studio` | Database බැලීමට GUI |
| `npm run db:seed` | Admin + ආයතන seed (නැවත run කළත් ආරක්ෂිතයි) |
| `npm run check:i18n` | පරිවර්තන යතුරු අඩුපාඩු පරීක්ෂාව |
| `npm run check:authz` | සියලු Server Actions වල role පරීක්ෂා ඇතිදැයි පරීක්ෂාව |

## 6. ව්‍යුහය

```
src/
├─ app/
│  ├─ (auth)/        login, register, verify-email, forgot/reset-password
│  ├─ (student)/     dashboard (ශ්‍රේණියට අනුව)
│  ├─ admin/         Admin panel
│  └─ actions/       Server Actions (auth.ts, admin.ts)
├─ components/       UI, forms
├─ db/               Drizzle schema + connection
├─ lib/              session, crypto, mail, validators, rate-limit
└─ proxy.ts          /dashboard, /admin සඳහා පළමු ආරක්ෂක ස්ථරය
drizzle/             SQL migrations
scripts/seed.ts
```

## 7. ඊළඟ අදියර

> Production වෙත යැවීමට: **[DEPLOY.md](DEPLOY.md)** (Vercel + Neon + R2 deploy guide සහ launch checklist) බලන්න.

6. ✅ ආරක්ෂාව ශක්තිමත් කිරීම (audit/hardening) - අවසන්
7. Deploy (Vercel + Neon + R2/S3 bucket)


## භාෂා (සිංහල / English)

- සෑම පිටුවකම ඉහළින් ඇති බොත්තමෙන් භාෂාව මාරු කළ හැක (`ict_lang` cookie එකේ සුරැකේ).
- පරිවර්තන `src/lib/i18n/en.ts` හි ඇත (යතුර = සිංහල පාඨය). කේතයේ `t("සිංහල පාඨය")` ලෙස භාවිතා කරයි.
- අලුත් පාඨයක් එක් කළ පසු `node scripts/check-i18n.mjs --list` ධාවනය කර අඩු පරිවර්තන බලන්න.
- Emails සිංහල සහ English දෙකෙන්ම යවයි.

## සිසුන්ගේ ගිණුම් ක්‍රියා

`/dashboard/profile`: නම/පාසල/දුරකතනය සංස්කරණය, මුරපදය වෙනස් කිරීම (අනෙක් උපාංග logout වේ), ගිණුම මකා දැමීම (මුරපදයෙන් තහවුරු කර).
ශ්‍රේණිය/මාධ්‍යය/ආයතනය වෙනස් කිරීමට ඉල්ලීමක් යවයි; Admin `/admin/requests` හි අනුමත කළ පසු පමණක් ක්‍රියාත්මක වේ. Email වෙනස් කළ හැක්කේ Admin ට පමණි.

## භූමිකා (Roles)

- **Super Admin** (ගුරුවරයා): `npm run db:seed` මගින් `ADMIN_EMAIL` / `ADMIN_PASSWORD` සමඟ සැදේ (පැරණි Admin ගිණුමක් තිබේ නම් Super Admin බවට පත් කරයි). සියලු Admin කාර්‍යයන් කළ හැකි අතර `/admin/admins` හි සහායක Admin ලා සෑදීම/සංස්කරණය/අත්හිටුවීම/මකා දැමීම සහ `/admin/activity` හි සියලු ක්‍රියා ඉතිහාසය බැලිය හැක. Super Admin ගිණුම UI එකෙන් මකා දැමීමට/අත්හිටුවීමට නොහැක.
- **Admin** (සහායක): සිසුන්, ආයතන, ඉල්ලීම් කළමනාකරණය; තමාගේ නම සහ මුරපදය (`/admin/account`) වෙනස් කළ හැක. Admin ලා කළමනාකරණය කළ නොහැක.
- **Student**: `/dashboard`, `/dashboard/profile`.

Admin ලාගේ මුරපද Super Admin ට පවා බැලීමට/වෙනස් කිරීමට නොහැක; ඔවුන් Email ඇරයුමෙන් තමාගේම මුරපදය සකසයි.


## පාඩම් සහ අන්තර්ගතය (Content)

- `npm run db:seed` මගින් 6–11 ශ්‍රේණි සහ උසස් පෙළ (A/L) සඳහා පාඩම් 108ක් (සිංහල/English මාධ්‍ය අනුව) දත්ත සමුදායට ඇතුළු කරයි. උසස් පෙළ සිංහල ඒකක නම් පරිවර්තන Admin ට `/admin/lessons` හි සංස්කරණය කළ හැක.
- **`/admin/lessons`**: ශ්‍රේණිය + මාධ්‍යය තෝරා පාඩම් බැලීම, අලුත් පාඩම් එක් කිරීම. පාඩමක් විවෘත කර එහි **Tute, Notes, පාඩම අනුව Past Papers සහ Model Papers (වර්ෂය සමඟ), පෙළපොත, වැඩපොත, රචනා, Recording** Google Drive links එක් කිරීම/සංස්කරණය/සඟවීම/මකා දැමීම.
- **`/admin/papers`**: පාඩමකට නොබැඳෙන Past Papers, Model Papers, Recordings, Notes (වර්ෂය සමඟ).
- Links පිළිගන්නේ `https://` සහිත Google Drive/Docs ලිපිනයන් පමණි.
- **Tutes (වෙනම වර්ගයක්)**: **`/admin/tutes`** හි ශ්‍රේණිය + මාධ්‍යය තෝරා Tute එකක් (නමක් + අංකයක්) සාදා, එයට **Model Papers, Past Papers (වර්ෂය සමඟ), Recordings සහ අමතර Notes** යන වර්ග 4 ට පමණක් Drive links එක් කළ හැක (පෙළපොත/වැඩපොත/රචනා/Tute වර්ග Tute එකකට එක් කළ නොහැක; server පැත්තෙන්ද බලපෑම් කරයි). Tutes `/admin/lessons` ලැයිස්තුවේ නොපෙනේ. සිසුන්ට: Dashboard හි **Tutes** කොටස, පැති මෙනුවේ **Tutes**, සහ `/dashboard/tutes/[id]` පිටුව (කොටස් 4 ක් පිළිවෙලින්). Tute එකක් එක් කළ විට/පෙන්වූ විට අදාළ ශ්‍රේණිය+මාධ්‍යයේ සිසුන්ට දැනුම්දීමක් යයි. Tute එකේ අන්තර්ගතය පාඩම්වලට සම්බන්ධ Past/Model Papers පිටු වල මිශ්‍ර නොවේ, ICT මිතුරාගේ පාඩම් ලැයිස්තුවටද ඇතුළත් නොවේ. (Database: `lessons.kind` = `LESSON` | `TUTE`, migration `0022`.)

- සිසුවාගේ Dashboard හි ඔහුගේ ශ්‍රේණිය + මාධ්‍යයට අදාළ **සෑම පාඩමකටම වෙනම කාඩ්පතක්** පෙන්වයි (ඇති අන්තර්ගත වර්ග chips ලෙස). කාඩ්පතක් එබූ විට **`/dashboard/lessons/[id]`** පාඩම් පිටුව විවෘත වේ: ඉහළ පුවරුවේ පාඩම + කොටස් වෙත පනින chips; පහළින් **Tute, Notes, Past Papers, Model Papers (පාඩම අනුව), පෙළපොත, වැඩපොත, රචනා, Recordings** වෙන වෙනම කොටස් ලෙසත්, ශ්‍රේණියට පොදු **අනෙකුත් Notes** වෙනම කොටසක් ලෙසත්, කලින් / ඊළඟ පාඩමට යාමත් ඇත. සඟවා ඇති පාඩම්/අයිතම සිසුන්ට නොපෙනේ; වෙනත් ශ්‍රේණියක/මාධ්‍යයක පාඩමක් විවෘත කළ නොහැක (404).


## පැවරුම් (Assignments)

- **Admin** (`/admin/assignments`): ශ්‍රේණිය + මාධ්‍යය (සහ අවශ්‍ය නම් එක් ආයතනයක්) තෝරා පැවරුමක් පැවරීම; උපදෙස්, Drive link (ප්‍රශ්න පත්‍රය), අවසාන දිනය/වේලාව (ශ්‍රී ලංකා වේලාව), උපරිම ලකුණු. සිසුන් උඩුගත කළ files බාගත කිරීම, ලකුණු සහ සටහන් දැමීම, ඉදිරිපත් කිරීමක් මකා නැවත උඩුගත කිරීමට ඉඩ දීම, ඉදිරිපත් නොකළ සිසුන් බැලීම.
- **සිසුවා** (`/dashboard/assignments`): තමාට පැවරූ පැවරුම් බලා, අවසාන දිනයට පෙර files (PDF, ඡායාරූප, Word, PowerPoint, Excel, ZIP) උඩුගත කිරීම/ඉවත් කිරීම. ලකුණු දැමූ පසු හෝ අවසාන දිනයෙන් පසු වෙනස් කළ නොහැක.
- Files: `S3_*` සකසා නැතිනම් **database එකේම** ගබඩා වේ; සකසා ඇත්නම් private bucket එකේ ("Files ගබඩාව" කොටස). එක් වරකට උපරිම 4MB (Vercel request සීමාව), එක් පැවරුමකට files 5ක්/15MB. Files බාගත කළ හැක්කේ ඒ සිසුවාට සහ Admin ලාට පමණි (`/api/files/[id]`); සැමවිටම download ලෙස යවයි.

## Quiz (කාල සීමා සහිත)

- **Admin** (`/admin/quizzes`): බහුවරණ (MCQ) ප්‍රශ්න (පිළිතුරු 2–6, ලකුණු, පැහැදිලි කිරීම), ආරම්භ/වසන වේලාව, සිසුවෙකුට ලැබෙන විනාඩි ගණන, පිළිතුරු පෙන්වීම. ප්‍රතිඵල බැලීම; සිසුවෙකුගේ උත්සාහය ඉවත් කර නැවත උත්සාහ කිරීමට ඉඩ දීම. සිසුන් උත්සාහ කළ පසු ප්‍රශ්න වෙනස් කළ නොහැක.
- **සිසුවා** (`/dashboard/quizzes`): Start ඔබන විට ටයිමරය ආරම්භ වේ (Quiz වසන වේලාව ඉක්මවන්නේ නැත). පිළිතුරු ස්වයංක්‍රීයව සුරැකේ; කාලය අවසන් වූ විට ස්වයංක්‍රීයව ඉදිරිපත් වේ. එක් වරක් පමණක් උත්සාහ කළ හැක. නිවැරදි පිළිතුරු browser එකට යවන්නේ නැත; ලකුණු ගණනය server එකේ සිදු වේ. නිවැරදි පිළිතුරු Quiz වසා දැමූ පසු පමණක් පෙන්වයි.
- සියලු දින/වේලාවන් ශ්‍රී ලංකා වේලාවෙන් (UTC+5:30) අර්ථ දැක්වේ.

## Email තහවුරු කිරීම (6-digit code)
- ලියාපදිංචි වූ විගස `/register/check-email` තිරයේදී email එකට ආ **ඉලක්කම් 6ක code එක** ඇතුළත් කරයි (පෙට්ටි 6, paste / auto-fill / auto-submit සහිතයි). Email එකේ ඇති link එකෙන්ද (පැය 24ක්) තහවුරු කළ හැක.
- Code එක **විනාඩි 10කින් expire** වේ (තිරයේ countdown එකක් පෙන්වයි). වැරදි උත්සාහ **5කට** පසු lock වේ — අලුත් code එකක් ඉල්ලිය යුතුයි; අලුත් code ඉල්ලීම **තත්පර 60** cooldown සමඟ.
- Code එක DB එකේ ගබඩා වන්නේ HMAC hash එකක් ලෙස පමණි (`email_otps` table; plain code කිසිදා ගබඩා නොවේ); සංසන්දනය timing-safe; IP සහ email අනුව rate limit; සාර්ථක වූ විට code එක මැකේ (නැවත භාවිතා කළ නොහැක).
- සාර්ථක වූ පසු `/set-password` තිරයට යොමු වේ. Dev mode හි code එක server console එකේ `[DEV EMAIL]` ලෙස පෙන්වයි.
- නව migration: `npm run db:migrate` (`email_otps`).

## Online පන්ති (Zoom link, පැය 24ක්)
- Admin → **Online පන්ති** (`/admin/classes`) හි Zoom link එකක් එක් කරන්න: පන්තියේ නම, Zoom link, සටහන (වේලාව/මුරපදය), ශ්‍රේණිය, මාධ්‍යය, (අවශ්‍ය නම්) ආයතනය.
- ඒ ශ්‍රේණියේ සිසුන්ට Dashboard එකේ ඉහළින් රතු "Online පන්තිය" card එකක් ලෙස **එක් කළ මොහොතේ සිට පැය 24ක්** පෙනේ; bell දැනුම්දීමක්ද යයි. පැය 24න් පසු ස්වයංක්‍රීයව සැඟවේ — කල් ඉකුත් වීම database query එකේදීම පරීක්ෂා වන නිසා link එක page එකටවත් යන්නේ නැත. Admin ට ඉතිහාසය බැලිය හැක / කලින් ඉවත් කළ හැක.
- Link එක `https://*.zoom.us` / `zoom.com` පමණක් පිළිගනී (client + server validation); වෙනත් site, http, `user:pass@` සහිත ඒවා ප්‍රතික්ෂේප වේ.
- නව migration: `npm run db:migrate` (`class_links`).

## ICT මිතුරා (AI Chat Agent)
- සිසුන්ට `/dashboard/agent` හි ICT ගැන ප්‍රශ්න අහන්න පුළුවන්. **සියලුම ශ්‍රේණි (6 - A/L)** සඳහා ක්‍රියා කරයි.
- **දත්ත සමුදායෙන් සිසුවා ගැන තොරතුරු** (පළමු නම, ශ්‍රේණිය/A/L වර්ෂය, මාධ්‍යය, ඒ ශ්‍රේණියේ පාඩම් ලැයිස්තුව) AI එකට system prompt එකෙන් දෙයි — ශ්‍රේණිය අනුව වයසට ගැලපෙන භාෂා ශෛලියකින් (6-7: ඉතා සරල/විනෝදජනක, 8-9: සරල, 10-11: O/L ශෛලිය, A/L: තාක්ෂණික) ආදරයෙන් පිළිතුරු දෙයි. දුරකතන/email/වෙනත් සිසුන්ගේ තොරතුරු කිසිවිටක නොයවයි.
- **ස්වයං අධ්‍යයනය**: පිළිතුර කෙළින්ම නොදී, hint + කුඩා ප්‍රශ්නයක් අසා, ඒ ශ්‍රේණියේ පාඩමක් කියවීමට යොමු කරයි; සෑම පිළිතුරකටම පසු "දැන් ඔබම උත්සාහ කරන්න" සිහිකැඳවීමක් පෙන්වයි.
- **Quiz වලදී උදව් නැත**: සිසුවා Quiz එකක් ආරම්භ කර තවම ඉදිරිපත් කර නැති විට (කාලය ඉකුත් නොවූ) Agent **server එකේම** අගුළු දමයි (chat tab එක කලින් විවෘත කර තිබුණත් credit එක ගන්නේවත් AI එක අමතන්නේවත් නැත). Quiz පිටුවේද මෙය දන්වයි.
- **Free credits**: සෑම සිසුවෙකුටම මුලින් credits 40ක් (පණිවිඩයක් = 1). අවසන් වූ විට මෘදු පණිවිඩයක්; Admin ට `/admin/agent` හි එක් සිසුවෙකුට හෝ සියලුම ක්‍රියාකාරී සිසුන්ට credits එක් කළ හැක. AI අසාර්ථක වූ විට credit එක ආපසු ලැබේ.
- **මුළු තිරයම**: `/dashboard/agent` හි side panel එක සහ ICT මිතුරා පමණක් පෙන්වයි (hero/bell/අමතර පිරිසැලසුම් නැත; පිටුව scroll නොවේ, ලිවීමේ කොටස සැමවිටම පහළ). Desktop හි ඉහළ-වම බොත්තමෙන් side panel එක **සඟවා / පෙන්විය** හැක — මෙය **සිසුන්ගේ සහ Admin ගේ සියලුම පිටු වලට** ඇත (තේරීම browser එකේ මතක තබා ගනී). Mobile හි menu බොත්තම ඇත.
- **Multimedia**: 📎 බොත්තම / paste / drag & drop මගින් **ඡායාරූප (JPG/PNG/WebP/GIF) සහ PDF** (පණිවිඩයකට 3ක් දක්වා) එක් කළ හැක. ඡායාරූප browser එකේදීම ≤1600px JPEG ලෙස පොඩි කරයි; PDF ≤3MB; මුළු ≤4MB. ගොනුවේ සැබෑ වර්ගය server එකේ magic bytes වලින් පරීක්ෂා කරයි. AI එකට vision/PDF ලෙස යවයි (පෙර පණිවිඩ වල ගොනු නම් පමණක්). **ගොනු සහිත පණිවිඩයක් = credits 2** (අසාර්ථක වූ විට ආපසු). Quiz කරමින් සිටින විට ගොනු සහිතවද අගුළුයි. ගොනු `/api/agent-file/[id]` හරහා (සිසුවාට සහ Admin ට පමණි; PDF සැමවිටම download) සහ Admin ට සංවාද බැලීමේදී පෙනේ.
- ආරක්ෂාව: විනාඩියකට පණිවිඩ 10ක සීමාව, අකුරු 600ක උපරිමය, AI පිළිතුරු HTML ලෙස නොව පෙළ ලෙස පමණක් පෙන්වයි, prompt-injection වලට එරෙහි උපදෙස්. සංවාද ගබඩා වන අතර (සිසුන්ට දන්වා ඇත) Admin ට `/admin/agent` හි බැලිය හැක.
- නව migration: `npm run db:migrate` (`agent_wallets`, `agent_messages`, `agent_attachments`).

### AI සහායක (ගුරුතුමා / Admin සඳහා)
- Admin ට `/admin/assistant` හි (සහ සෑම පිටුවකම නිතර පෙනෙන **AI සහායක** බොත්තමෙන්) තමන්ගේම කටයුතු සඳහා AI එක භාවිතා කළ හැක: පාඩම් සැලසුම්, MCQ/ප්‍රශ්න පත්‍ර + පිළිතුරු, දෙමාපියන්ට/සිසුන්ට දැන්වීම්, ප්‍රතිපෝෂණ comments, සිංහල ⇄ English පරිවර්තන, ඡායාරූප/PDF විශ්ලේෂණය, Admin මෙවලම් භාවිතා කිරීමට උපදෙස්.
- සිසුන්ගේ ICT මිතුරාට වඩා වෙනස්: **Credits නැත, Quiz අගුල නැත**, වෙනම (ගුරුවරයෙකුට ගැලපෙන) system prompt, අකුරු 4000ක් දක්වා ආදානය, දිගු පිළිතුරු (Anthropic 3500 / Gemini 6000 tokens), විනාඩියකට පණිවිඩ 20ක සීමාව.
- Admin ගේ සංවාද ඔහුට පමණි (`/admin/agent` සිසුන්ගේ සංවාද බැලීමේ පිටුවෙන් පෙනෙන්නේ නැත; එම පිටුවේ සංඛ්‍යා වලට Admin ගිණුම් ඇතුළත් නොවේ). AI එකට සිසුන්ගේ පුද්ගලික දත්ත නොයවයි (පාඩම් ලැයිස්තුව පමණි).
- සිසුන්ගේ ICT මිතුරා පාලනය (credits ලබාදීම, සංවාද බැලීම) දැන් sidebar හි **ICT මිතුරා පාලනය** ලෙස ඇත.

## Profile ඡායාරූපය

සිසුන්ට සහ Admin ලාට තමාගේ ගිණුම් පිටුවෙන් (පැති තීරුවේ, Dashboard හි, Admin ලැයිස්තුවල ද පෙනේ) ඡායාරූපයක් එක් කිරීමට/වෙනස් කිරීමට/ඉවත් කිරීමට හැක.

- Browser එකේදීම 256×256 JPEG (≈30KB) ලෙස කොටු කපා කුඩා කරයි; Server එක නැවත පරීක්ෂා කරයි (magic-bytes: JPEG/PNG/WebP පමණි, උපරිම 400KB, rate limit)
- `user_avatars` table (migration `0011`): SHA-256 integrity, ගිණුම මැකූ විට cascade
- `/api/avatar/[id]`: තමාගේ ඡායාරූපය පමණක් (Admin ට සියල්ලම), `nosniff`, ETag, private cache; වෙනත් සිසුවෙකුගේ එක 404 + audit
- කේතය: `src/components/avatar-form.tsx`, `src/app/actions/avatar.ts`, `src/lib/avatar.ts`

## දැනුම්දීම් (Notifications)

සියලු දෙනාට (සිසුන්, Admin ලා, Super Admin) ඉහළින් **bell බොත්තමක්** සහ දැනුම්දීම් panel එකක් ඇත (නොකියවූ ගණන රතු badge එකකින්). තත්පර 20කට වරක්, පිටුව මාරු කළ විට සහ tab එකට ආපසු ආ විට තනිවම නවීකරණය වේ (අලුත් දැනුම්දීමක් ආ විට පිටුවේ දත්ත ද `router.refresh()` මගින් යාවත්කාලීන වේ). Panel එකේ දෝෂයක් වුවහොත් "නැවත උත්සාහ කරන්න" බොත්තමක් පෙන්වයි. දැනුම්දීමක් එබූ විට කියවූ ලෙස සලකුණු වී අදාළ පිටුවට යයි; "සියල්ල කියවූ ලෙස සලකුණු කරන්න" ද ඇත. භාෂාව මාරු කළ විට දැනුම්දීම් ද මාරු වේ (DB හි ගබඩා කරන්නේ සිදුවීම් වර්ගය + පරාමිති පමණි).

- **සිසුන්ට**: ගිණුම අනුමත වීම (+ **Email එකක්**), නැවත සක්‍රීය වීම, නව පාඩම, නව Drive අන්තර්ගතය, නව පැවරුම, පැවරුම ලකුණු කිරීම, නව Quiz, Quiz නැවත සැකසීම, වෙනස් කිරීමේ ඉල්ලීම අනුමත/ප්‍රතික්ෂේප. (ශ්‍රේණිය + මාධ්‍යය + ආයතනයට අදාළ සක්‍රීය සිසුන්ට පමණි.)
- **Admin ලාට**: නව ලියාපදිංචිය, Email තහවුරු කර මුරපදය සෑදූ සිසුවා (අනුමැතිය බලාපොරොත්තුවෙන්), වෙනස් කිරීමේ ඉල්ලීම, පැවරුම ඉදිරිපත් කිරීම, Quiz සම්පූර්ණ කිරීම, සිසුවෙකු ගිණුම මකා දැමීම. (ක්‍රියාව කළ අයට නොයැවේ.)
- අනුමත කළ සිසුවාට සිංහල + English Email එකක් යවයි (තනි සහ bulk අනුමැතිය දෙකෙහිම). Email අසාර්ථක වුවද අනුමැතිය පවතී.
- අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්ට bell නොපෙන්වයි. දින 90ට වඩා පරණ දැනුම්දීම් ඉඳහිට ස්වයංක්‍රීයව ඉවත් වේ.
- කේතය: `src/lib/notify.ts` (යැවීම), `src/lib/notification-render.ts` (පෙළ), `src/components/notifications.tsx` (UI), `src/app/api/notifications/route.ts`.

## Testimonials (landing page)

Admin / Super Admin: **Admin → අදහස් (Testimonials)**. සිසුන්/දෙමාපියන්ගේ සැබෑ අදහස් එක් කර, වෙනස් කර, Landing page එකේ **පෙන්වීම / සැඟවීම** පාලනය කළ හැක. පෙන්වන ඒවා එකක්වත් නැත්නම් landing page එකේ මෙම කොටස සම්පූර්ණයෙන්ම සැඟවේ. (නව migration: `npm run db:migrate`)

**සිසුන්ගේ අදහස් (student submissions):** සිසුන්ට **මගේ අදහස** (`/dashboard/feedback`) පිටුවෙන් තමන්ගේ අදහස යැවිය හැක. එය **PENDING** ලෙස සුරැකේ; Admin **අදහස් → අනුමත කිරීමට (Pending)** tab එකෙන් අනුමත / ප්‍රතික්ෂේප කළ පසු පමණක් Landing page එකේ පෙනේ (සිසුවාට දැනුම්දීමක් ලැබේ).
- පෙන්වන්නේ **මුල් නම හෝ මුලකුරු** පමණි (සම්පූර්ණ නම කිසිවිටක නොපෙන්වයි); ශ්‍රේණිය පෙන්වීම විකල්පයකි; **පැහැදිලි එකඟතා checkbox** අනිවාර්යයි.
- සිසුවෙකුට උපරිම අදහස් 5ක්, එකවර PENDING එකක් පමණි; සිසුවාට තමන්ගේ අදහස ඉවත් කළ හැක; ගිණුම මකා දැමූ විට ඔහුගේ අදහස් ද මැකේ.
- පාසල් සිසුන් (18 ට අඩු) සම්බන්ධයෙන් පළ කිරීමට පෙර දෙමාපිය අවසරය ලබා ගැනීම නිර්දේශ කෙරේ.
- නව migration `0017_testimonial_submissions` (`npm run db:migrate`).

## සංවාද මණ්ඩපය (Discussion Hall)

සිසුන්ට **සංවාද මණ්ඩපය** (`/dashboard/community`) සහ Admin ට `/admin/community`. කොටස් දෙකක්:
- **Forum (මාතෘකා):** මාතෘකා (threads) සහ පිළිතුරු (replies). Admin ට මාතෘකා **සැඟවීම / මැකීම / ලොක් කිරීම / ඉහළට සවි කිරීම** කළ හැක.
- **Live chat:** කාමරයේ සිටින අයට සජීවීව පණිවිඩ (තත්පර 4කට වරක් නව පණිවිඩ ලබාගනී; `/api/chat`).

**කාමර:** `general` (සියලු දෙනා) + ශ්‍රේණියක් බැගින් (`g6`…`g11`, `al`). සිසුවෙකුට තමන්ගේ ශ්‍රේණි කාමරය සහ පොදු කාමරය පමණි (URL වෙනස් කළත් වෙනත් ශ්‍රේණියක කාමරයක් නොපෙනේ; API එකද 403 දෙයි). Admin ට සියල්ල.

**ළමයින්ගේ ආරක්ෂාව:**
- සිසුන්ගේ නම ලෙස **මුල් නම + ශ්‍රේණිය** පමණක් පෙන්වයි (Admin: සම්පූර්ණ නම + "ගුරුතුමා" ලකුණ).
- සිසුන්ට **link, email, දුරකථන අංක, WhatsApp/Telegram** යැවීමට ඉඩ නැත (සේවාදායක පැත්තෙන් පෙරහන; `containsContactInfo` in `src/lib/community.ts`).
- Rate limits: මාතෘකා පැයකට 5, පිළිතුරු විනාඩි 10කට 20, chat තත්පර 30කට 12.
- සිසුවාට අනුචිත පණිවිඩ **වාර්තා (Report)** කළ හැක → Admin → සංවාද මණ්ඩපය → **වාර්තා සහ පාලනය**: සඟවා නිරාකරණය කිරීම, **Mute** (දවසක් / සතියක් / ස්ථිරව) සහ නැවත විවෘත කිරීම. සියලු පාලන ක්‍රියා ක්‍රියා ඉතිහාසයේ (audit) සටහන් වේ.
- සිසුවාගේ ගිණුම මැකූ විට ඔහුගේ මාතෘකා, පිළිතුරු සහ chat පණිවිඩ ද මැකේ. Chat පණිවිඩ දින 30කට පසු ස්වයංක්‍රීයව ඉවත් වේ.
- පණිවිඩ ක්ෂණිකව පළවේ (පූර්ව අනුමැතියක් නැත); Admin පසුව සඟවයි/මකයි. සිසුන් 18 ට අඩු නිසා, අවශ්‍ය නම් දෙමාපිය දැනුම්දීමක් ලබාදීම නිර්දේශ කෙරේ.
- නව migration `0018_community` (`npm run db:migrate`).

> Live chat පෙනුම: නිල් gradient header (තරංග හැඩයෙන් අවසන්), pill හැඩැති පණිවිඩ බුබුළු (කාලය බුබුළු යටින්), වටකුරු යවන බොත්තම සහ 😊 Emoji තේරීම — පැත්තේ dock එකේත්, සම්පූර්ණ chat පිටුවේත් එකම ආකාරයට.

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
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail ගිණුමේ **2-Step Verification** ON කර, Google Account → Security → **App passwords** වලින් මුරපදයක් සාදන්න. සාමාන්‍ය Gmail මුරපදය ක්‍රියා නොකරයි |
| `APP_SECRET` | අඩු තරමින් අක්ෂර 32ක random රහස් අගයක් (`openssl rand -base64 48`). 2-step secrets සංකේතනයට සහ audit log hash chain එකට භාවිතා වේ. **Production හිදී අනිවාර්යයි; වෙනස් කළොත් Admin ලාගේ 2-step ක්‍රියා නොකරයි (reset කිරීමට සිදුවේ) සහ audit chain තහවුරු නොවේ - ආරක්ෂිතව backup කරන්න** |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | පළමු Admin ගිණුම (seed වලදී පමණක් භාවිතා වේ, අවම අක්ෂර 10). ආයතන 5 (පන්ති ස්ථාන) `src/lib/constants.ts` මගින් seed වේ |

**Development වලදී** Gmail keys නැතිව වුවද වැඩ කරයි: Email එක යවනවා වෙනුවට terminal එකේ (console) link එක
පෙන්වයි. **Production වලදී** Gmail keys අනිවාර්යයි (නැත්නම් Email යැවෙන්නේ නැත).

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
- එක් email එකකට විනාඩි 10 ක් තුළ අසාර්ථක login 6 ක් වුවහොත් තාවකාලිකව අවහිර වේ (ප්‍රහාරකයෙකුට අන් කෙනෙකුගේ ගිණුම තාවකාලිකව අවහිර කළ හැක)
- CSP හි `'unsafe-inline'` ඇත (Next.js inline scripts සඳහා; nonce පසුව එක් කළ හැක)
- Audit log හි **අග කොටස ඉවත් කිරීම** (tail truncation) hash chain මගින් හඳුනාගත නොහැක; Neon backups සමඟ බලන්න
- Authenticator app නැති වී recovery codes ද නැති Admin කෙනෙකුගේ 2-step reset කළ හැක්කේ Super Admin ට (Admin → Admin ලා → reset). Super Admin ගේම එක නැති වුවහොත් database හරහා අතින් reset කළ යුතුය
- Files Postgres හි ගබඩා වේ (එක් request එකකට 4MB). වැඩි වුවහොත් Vercel Blob/S3 වෙත මාරු කරන්න
- Production හිදී **Neon backups / point-in-time recovery** සක්‍රීය කරන්න
- `npm audit --omit=dev` : දුර්වලතා 0

## Design (UI)

- වර්ණ: navy (`#0b1633`), logo නිල් (`#0a5cc2`), logo රතු (`#e60008`) සහ ගුරුවරයාගේ ඡායාරූපයෙන් ගත් කහ (`sun`). සියල්ල `src/app/globals.css` හි `@theme` තුළ
- අකුරු: Bricolage Grotesque (මාතෘකා), Plus Jakarta Sans (සාමාන්‍ය), Noto Sans Sinhala (සිංහල)
- රාමුව: විශාල තිරයේ වම් sidebar, දුරකථනයේ menu drawer (`src/components/app-shell.tsx`). Login/ලියාපදිංචි පිටු split-screen (`src/app/(auth)/layout.tsx`)
- පොදු `card` ශ්‍රේණිය, `btnPrimary`/`btnSun` සහ අනෙක් primitives `ui.tsx` හි

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

6. ✅ ආරක්ෂාව ශක්තිමත් කිරීම (audit/hardening) - අවසන්
7. Deploy (Vercel + Neon); වැඩි ගබඩා ඉඩක් අවශ්‍ය නම් පැවරුම් files Vercel Blob/S3 වෙත මාරු කිරීම


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
- සිසුවාගේ Dashboard හි ඔහුගේ ශ්‍රේණිය + මාධ්‍යයට අදාළ **සෑම පාඩමකටම වෙනම කාඩ්පතක්** පෙන්වයි (ඇති අන්තර්ගත වර්ග chips ලෙස). කාඩ්පතක් එබූ විට **`/dashboard/lessons/[id]`** පාඩම් පිටුව විවෘත වේ: ඉහළ පුවරුවේ පාඩම + කොටස් වෙත පනින chips; පහළින් **Tute, Notes, Past Papers, Model Papers (පාඩම අනුව), පෙළපොත, වැඩපොත, රචනා, Recordings** වෙන වෙනම කොටස් ලෙසත්, ශ්‍රේණියට පොදු **අනෙකුත් Notes** වෙනම කොටසක් ලෙසත්, කලින් / ඊළඟ පාඩමට යාමත් ඇත. සඟවා ඇති පාඩම්/අයිතම සිසුන්ට නොපෙනේ; වෙනත් ශ්‍රේණියක/මාධ්‍යයක පාඩමක් විවෘත කළ නොහැක (404).


## පැවරුම් (Assignments)

- **Admin** (`/admin/assignments`): ශ්‍රේණිය + මාධ්‍යය (සහ අවශ්‍ය නම් එක් ආයතනයක්) තෝරා පැවරුමක් පැවරීම; උපදෙස්, Drive link (ප්‍රශ්න පත්‍රය), අවසාන දිනය/වේලාව (ශ්‍රී ලංකා වේලාව), උපරිම ලකුණු. සිසුන් උඩුගත කළ files බාගත කිරීම, ලකුණු සහ සටහන් දැමීම, ඉදිරිපත් කිරීමක් මකා නැවත උඩුගත කිරීමට ඉඩ දීම, ඉදිරිපත් නොකළ සිසුන් බැලීම.
- **සිසුවා** (`/dashboard/assignments`): තමාට පැවරූ පැවරුම් බලා, අවසාන දිනයට පෙර files (PDF, ඡායාරූප, Word, PowerPoint, Excel, ZIP) උඩුගත කිරීම/ඉවත් කිරීම. ලකුණු දැමූ පසු හෝ අවසාන දිනයෙන් පසු වෙනස් කළ නොහැක.
- Files **database එකේම** ගබඩා වේ (අමතර storage සේවාවක් අවශ්‍ය නැත). එක් වරකට උපරිම 4MB (Vercel request සීමාව), එක් පැවරුමකට files 5ක්/15MB. Files බාගත කළ හැක්කේ ඒ සිසුවාට සහ Admin ලාට පමණි (`/api/files/[id]`); සැමවිටම download ලෙස යවයි.

## Quiz (කාල සීමා සහිත)

- **Admin** (`/admin/quizzes`): බහුවරණ (MCQ) ප්‍රශ්න (පිළිතුරු 2–6, ලකුණු, පැහැදිලි කිරීම), ආරම්භ/වසන වේලාව, සිසුවෙකුට ලැබෙන විනාඩි ගණන, පිළිතුරු පෙන්වීම. ප්‍රතිඵල බැලීම; සිසුවෙකුගේ උත්සාහය ඉවත් කර නැවත උත්සාහ කිරීමට ඉඩ දීම. සිසුන් උත්සාහ කළ පසු ප්‍රශ්න වෙනස් කළ නොහැක.
- **සිසුවා** (`/dashboard/quizzes`): Start ඔබන විට ටයිමරය ආරම්භ වේ (Quiz වසන වේලාව ඉක්මවන්නේ නැත). පිළිතුරු ස්වයංක්‍රීයව සුරැකේ; කාලය අවසන් වූ විට ස්වයංක්‍රීයව ඉදිරිපත් වේ. එක් වරක් පමණක් උත්සාහ කළ හැක. නිවැරදි පිළිතුරු browser එකට යවන්නේ නැත; ලකුණු ගණනය server එකේ සිදු වේ. නිවැරදි පිළිතුරු Quiz වසා දැමූ පසු පමණක් පෙන්වයි.
- සියලු දින/වේලාවන් ශ්‍රී ලංකා වේලාවෙන් (UTC+5:30) අර්ථ දැක්වේ.

## දැනුම්දීම් (Notifications)

සියලු දෙනාට (සිසුන්, Admin ලා, Super Admin) ඉහළින් **bell බොත්තමක්** සහ දැනුම්දීම් panel එකක් ඇත (නොකියවූ ගණන රතු badge එකකින්). විනාඩියකට වරක් සහ tab එකට ආපසු ආ විට තනිවම නවීකරණය වේ. දැනුම්දීමක් එබූ විට කියවූ ලෙස සලකුණු වී අදාළ පිටුවට යයි; "සියල්ල කියවූ ලෙස සලකුණු කරන්න" ද ඇත. භාෂාව මාරු කළ විට දැනුම්දීම් ද මාරු වේ (DB හි ගබඩා කරන්නේ සිදුවීම් වර්ගය + පරාමිති පමණි).

- **සිසුන්ට**: ගිණුම අනුමත වීම (+ **Email එකක්**), නැවත සක්‍රීය වීම, නව පාඩම, නව Drive අන්තර්ගතය, නව පැවරුම, පැවරුම ලකුණු කිරීම, නව Quiz, Quiz නැවත සැකසීම, වෙනස් කිරීමේ ඉල්ලීම අනුමත/ප්‍රතික්ෂේප. (ශ්‍රේණිය + මාධ්‍යය + ආයතනයට අදාළ සක්‍රීය සිසුන්ට පමණි.)
- **Admin ලාට**: නව ලියාපදිංචිය, Email තහවුරු කර මුරපදය සෑදූ සිසුවා (අනුමැතිය බලාපොරොත්තුවෙන්), වෙනස් කිරීමේ ඉල්ලීම, පැවරුම ඉදිරිපත් කිරීම, Quiz සම්පූර්ණ කිරීම, සිසුවෙකු ගිණුම මකා දැමීම. (ක්‍රියාව කළ අයට නොයැවේ.)
- අනුමත කළ සිසුවාට සිංහල + English Email එකක් යවයි (තනි සහ bulk අනුමැතිය දෙකෙහිම). Email අසාර්ථක වුවද අනුමැතිය පවතී.
- අනුමැතිය බලාපොරොත්තුවෙන් සිටින සිසුන්ට bell නොපෙන්වයි. දින 90ට වඩා පරණ දැනුම්දීම් ඉඳහිට ස්වයංක්‍රීයව ඉවත් වේ.
- කේතය: `src/lib/notify.ts` (යැවීම), `src/lib/notification-render.ts` (පෙළ), `src/components/notifications.tsx` (UI), `src/app/api/notifications/route.ts`.

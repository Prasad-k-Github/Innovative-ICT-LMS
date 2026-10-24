# Production වෙත යැවීමේ මාර්ගෝපදේශය (Innovative ICT)

මෙය පියවරෙන් පියවර deploy guide එකක් සහ launch checklist එකකි. කේතය සූදානම්; පහත පියවර ඔබේම ගිණුම් (Vercel, Neon, Cloudflare) තුළ කළ යුතුයි.

**නිර්දේශිත අනුපිළිවෙල:** (A) deploy → (B) ආරක්ෂාව සහ backup → (C) සැබෑ පරීක්ෂා → (D) සිසුන් 5-10ක pilot (සති 2-3) → (E) සම්පූර්ණ launch.

---

## A. Deploy කිරීම (Vercel + Neon + R2)

| සේවාව | කාර්යය | නිදහස් plan |
|---|---|---|
| **Vercel** | Next.js app | Hobby (පුද්ගලික/ලාභ නොලබන). ව්‍යාපාරික භාවිතයට නීතිමය වශයෙන් Pro ($20/මස) අවශ්‍යයි. |
| **Neon** | PostgreSQL | Free tier ඇත; PITR (point-in-time restore): Free හි කෙටි කාලයක් පමණි, දිගු කාලයක් සඳහා paid plan |
| **Cloudflare R2** (හෝ AWS S3 / Backblaze B2) | සිසුන්ගේ files, ඡායාරූප | 10GB නිදහස්, egress ගාස්තු නැත |
| **Cloudflare Turnstile** | Bot ආරක්ෂාව (CAPTCHA) | නිදහස් |
| **Gmail App Password** | Email යැවීම | දිනකට ~500 ක සීමාව |

> **Region:** Vercel Functions region එක `sin1` (Singapore) හෝ `bom1` (Mumbai) තෝරන්න; Neon region එක `ap-southeast-1` (Singapore). ශ්‍රී ලංකාවට ආසන්නතම නිසා වේගවත් වේ. Function සහ DB එකම region එකේ තිබිය යුතුයි.

### 1. Neon (database)
1. neon.tech හි project එකක් සාදන්න (region: Singapore).
2. **Connection string** (pooled **නොවන** එක migrate සඳහා; pooled එක app සඳහා) පිටපත් කරන්න. `?sslmode=require` සමඟ.
3. පළමුව ඔබේ පරිගණකයෙන් schema එක සාදන්න:
   ```bash
   DATABASE_URL="postgresql://…neon…?sslmode=require" npm run db:migrate
   DATABASE_URL="postgresql://…neon…?sslmode=require" ADMIN_NAME="…" ADMIN_EMAIL="…" ADMIN_PASSWORD="…ශක්තිමත්…" npm run db:seed
   ```
4. Seed එකෙන් පසු admin ගිණුමට පිවිස **වහාම මුරපදය වෙනස් කරන්න**.

### 2. Cloudflare R2 (files)
1. R2 bucket එකක් සාදන්න (**Private**; public access නොදෙන්න).
2. API token (Object Read & Write, මෙම bucket පමණක්) සාදන්න.
3. Env vars: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` (`https://<account>.r2.cloudflarestorage.com`), `S3_REGION=auto`.
4. Bucket versioning / lifecycle rule සක්‍රීය කරන්න (අහම්බෙන් මකා දැමුවොත් ආපසු ගැනීමට).
5. දැනටමත් database එකේ files තිබේ නම්: `npm run storage:migrate`.

### 3. Vercel (app)
1. GitHub repo එක (`Prasad-k-Github/Innovative-ICT-LMS`) Vercel වෙත import කරන්න. Framework: Next.js (auto).
2. **Settings → Functions → Region** = Singapore (`sin1`).
3. **Settings → Environment Variables** (Production):

| Variable | අගය |
|---|---|
| `DATABASE_URL` | Neon connection string (pooled) |
| `APP_URL` | `https://ඔබේ-domain` (email සබැඳි සඳහා; අවසානයේ `/` නැත) |
| `APP_SECRET` | අහඹු දිගු අගයක්: `openssl rand -base64 48`. **පසුව වෙනස් නොකරන්න** (සියලු සැසි/ටෝකන් අවලංගු වේ). |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Gmail ගිණුම + App Password (2-step verification සක්‍රීය කර සාදන්න) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed සඳහා පමණි |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | AI සඳහා (එකක් හෝ දෙකම). `GEMINI_FALLBACK_MODEL` ऐच්छික |
| `S3_*` | ඉහත R2 අගයන් |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Turnstile (දෙකම තිබිය යුතුයි) |

4. Deploy. පසුව **Domain** එකක් එක් කරන්න (HTTPS ස්වයංක්‍රීයයි).
5. පරීක්ෂා: `https://ඔබේ-domain/api/health` → `ok` ලැබිය යුතුයි.

> **AI timeout:** AI chat පිටු සඳහා `maxDuration = 60` සකසා ඇත. Hobby plan හි උපරිමය තත්පර 60. සෙමින් ක්‍රියා කරන විට (retry/fallback) ඊට වඩා ගත වේ නම් Pro plan එකක 300 දක්වා ඉහළ දමන්න (`src/app/(student)/dashboard/agent/page.tsx` සහ `src/app/admin/assistant/page.tsx`).
>
> **Upload සීමාව:** Vercel request body සීමාව ≈4.5MB නිසා, එකවර උඩුගත කිරීම 4MB ට සීමා කර ඇත.

---

## B. ආරක්ෂාව සහ Backup

- [ ] **Neon backups:** PITR සක්‍රීය කර ඇත්දැයි බලන්න (Settings → Storage → restore window). වෙනම `pg_dump` ද සතිපතා ගන්න:
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
  ```
  **Restore එක එක් වතාවක් පරීක්ෂා කරන්න** (නැවත ගත නොහැකි backup එක backup එකක් නොවේ).
- [ ] **R2 versioning** සක්‍රීයයි; `npm run storage:gc -- --dry` මාසිකව ධාවනය කර අනාථ files පරීක්ෂා කරන්න.
- [ ] **රහස් සුරක්ෂිත කරන්න:** `APP_SECRET`, admin මුරපදය, DB URL, R2 keys, API keys: password manager එකක (Bitwarden වැනි).
- [ ] **AI වියදම් සීමාව:** Anthropic / Google Cloud console හි **මාසික spend limit** සහ alert සකසන්න. Credits ක්‍රමය (පණිවිඩයකට 1) තිබුණත් සැබෑ ගාස්තුව token අනුව වෙනස් වේ.
- [ ] **Turnstile:** Cloudflare dashboard හි domain එක (production) widget එකට එක් කර ඇත.
- [ ] **Admin ගිණුම:** ශක්තිමත් මුරපදය; අනවශ්‍ය admin ගිණුම් නැත.
- [ ] **Security scan:** OWASP ZAP baseline scan (නිදහස්) production URL එකට:
  ```bash
  docker run -t zaproxy/zap-stable zap-baseline.py -t https://ඔබේ-domain
  ```

## C. සැබෑ පරිසරයේ පරීක්ෂා (මම sandbox එකෙන් කළ නොහැකි දේ)

- [ ] **සැබෑ email:** ලියාපදිංචිය → තහවුරු කේතය → index email → මුරපදය අමතක වීම → මුරපදය වෙනස් කිරීම. Gmail, Outlook, Yahoo හි spam folder එකට යන්නේද බලන්න.
- [ ] **සැබෑ AI:** ICT මිතුරා (ප්‍රශ්න, ඡායාරූපය, PDF) සහ admin සහායක. සිංහල පිළිතුරු ගුණාත්මකභාවය.
- [ ] **සැබෑ දුරකථන:** Android Chrome සහ **iPhone Safari**, මන්දගාමී mobile data (3G/4G) මත, පිටු වේගය සහ upload.
- [ ] **සම්පූර්ණ ගමන:** ලියාපදිංචිය → පාඩම් → පැවරුම් upload → Quiz → Zoom ලින්ක් → දැනුම්දීම්.
- [ ] **Turnstile** සැබෑ key වලින් login/register ක්‍රියා කරයි.
- [ ] **දෝෂ නිරීක්ෂණය:** Vercel Logs බලන ක්‍රමය දැන ගන්න; (ඉල්ලුවොත් Sentry නිදහස් plan එකක් එක් කළ හැක.)
- [ ] **Uptime monitor:** UptimeRobot (නිදහස්) මගින් `/api/health` සෑම විනාඩි 5කට.

## D. නීතිමය / පෞද්ගලිකත්වය

- [ ] **ළමයින්ගේ දත්ත:** සිසුන් බොහෝ දෙනා වයස 18ට අඩුයි. පෞද්ගලිකත්ව ප්‍රතිපත්තිය, දෙමාපිය/භාරකරු කැමැත්ත ලබාගන්න ක්‍රමයක් සකසන්න.
- [ ] **AI සපයන්නාට යන දත්ත:** Gemini **free tier** හි දත්ත ආකෘති පුහුණුවට භාවිතා වීමට ඉඩ ඇත. සිසුන්ගේ පණිවිඩ/ඡායාරූප යවන නිසා **paid tier** (දත්ත පුහුණුවට නොයන) තෝරන්න, නැතහොත් Anthropic API (පෙරනිමියෙන් පුහුණුවට නොගනී) භාවිතා කරන්න.
- [ ] Cookies / පෞද්ගලිකත්ව පිටු (දැනටමත් ඇත) ඔබේ සැබෑ තොරතුරු (සම්බන්ධතා, දත්ත රඳවා ගැනීම) සමඟ යාවත්කාලීන කරන්න.

## E. Pilot → Launch

1. **Pilot (සති 2-3):** සිසුන් 5-10ක්, සැබෑ පන්ති භාවිතය. ඔවුන්ගේ ප්‍රතිචාර (ගැටලු, ව්‍යාකූල තැන්) එකතු කරන්න.
2. **මෙම අවධියේ නිරීක්ෂණය කරන්න:** Vercel logs හි 5xx; email ලැබීම; AI වියදම; DB ප්‍රමාණය (Neon free: 0.5GB); R2 භාවිතය.
3. **Launch ට පෙර:** B-D checklist සම්පූර්ණයි, backup restore පරීක්ෂා කර ඇත.
4. **Launch පසු:** පළමු සතිය දිනපතා logs බලන්න; සිසුන් ගණන වැඩි වන විට Neon/Vercel plan ඉහළ දමන්න.

## F. හදිසි අවස්ථා

| ගැටලුව | කළ යුතු දේ |
|---|---|
| අඩවිය ක්‍රියා නොකරයි | `/api/health` බලන්න → Vercel Logs → Neon dashboard (DB නිද්‍රාගතද?) |
| Email නොයයි | Gmail App Password වලංගුද? දෛනික සීමාව (≈500) ඉක්මවා ඇත්ද? |
| AI අසාර්ථකයි | Provider status; key / quota; spend limit; fallback model සකසා ඇත්ද |
| දත්ත මැකී ගියා | Neon PITR restore; R2 versioning |
| Admin මුරපදය අමතකයි | "මුරපදය අමතකද?" පිටුව භාවිතා කරන්න (admin email එකට කේතය යයි) |
| ආරක්ෂක සිද්ධියක් | `APP_SECRET` වෙනස් කරන්න (සියලු සැසි අවලංගු වේ), API keys / DB මුරපද rotate කරන්න |

## G. මුදල් (ආසන්න)

| අයිතමය | Pilot | Launch |
|---|---|---|
| Vercel | නිදහස් (Hobby) | Pro $20/මස (ව්‍යාපාරික භාවිතයට) |
| Neon | නිදහස් | Launch ~$19/මස (දිගු PITR, වැඩි ඉඩ; වත්මන් මිල බලන්න) |
| R2 | නිදහස් (10GB) | ~$0.015/GB/මස |
| Domain | ~$10-15/වසර | එසේම |
| AI | spend limit එකකින් | සිසුන් ගණන × භාවිතය |

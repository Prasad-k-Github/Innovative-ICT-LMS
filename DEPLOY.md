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
5. **Least privilege (අනිවාර්යයි):** ඇප් එක (Vercel) database එකට සම්බන්ධ විය යුත්තේ DROP/ALTER/TRUNCATE කළ නොහැකි වෙනම user කෙනෙකුගෙනි. Neon හි **SQL Editor** එකේ:
   ```sql
   CREATE ROLE ict_app LOGIN PASSWORD '<ශක්තිමත්-අහඹු-මුරපදයක්>';
   ```
   ඉන්පසු (OWNER URL එකෙන්, migrations ධාවනය කළ පසු):
   ```bash
   DATABASE_URL="postgresql://…OWNER…?sslmode=require" npm run db:least-privilege -- ict_app
   ```
   **Vercel හි** `DATABASE_URL` = `ict_app` ගිණුමේ connection string (pooled). **OWNER URL** ඔබේ පරිගණකයේ පමණක් (`.env.local`, migrate / seed සඳහා) තබන්න; එය Vercel වෙත නොදමන්න. ප්‍රතිඵලය: ඇප් එකට පේළි කියවීම/ඇතුළත් කිරීම/සංස්කරණය/මැකීම පමණි; `audit_logs` (ආරක්ෂක ලොග්) append-only. අලුත් migration එකකින් අලුත් table එකක් එක් කළ විටත් ස්වයංක්‍රීයව එම අවසරම ලැබේ (OWNER ගිණුමින් migrate කළ විට).

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
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | පරීක්ෂා/pilot සඳහා Gmail + App Password. **Launch සඳහා පහත "Email spam" කොටසේ SMTP ක්‍රමය නිර්දේශිතයි** |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO` | ඔබේම domain එකකින් email යැවීමට (විකල්ප; සකසා ඇත්නම් Gmail වෙනුවට මෙය භාවිතා වේ) |
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

## Email spam folder එකට යාම

පුද්ගලික Gmail ගිණුමකින් (App Password හරහා) යවන email නව sender කෙනෙකුගෙන් එන "තහවුරු කරන්න" සහ "link/code" වැනි පණිවිඩ ලෙස පෙනෙන නිසා spam වීමට ඉඩ වැඩියි. මෙය කේත දෝෂයක් නොවේ; **sender reputation** ගැටලුවක්.

**පළමුව හේතුව සොයන්න:** Gmail හි spam එකට ගිය email එක විවෘත කර ⋮ → **Show original** තෝරන්න. ඉහළ ඇති `SPF`, `DKIM`, `DMARC` තුනම **PASS** ද බලන්න. (Gmail ගිණුමකින් යවන විට සාමාන්‍යයෙන් PASS; එවිට ගැටලුව reputation / අන්තර්ගතයයි.)

**නිවැරදි විසඳුම (Launch ට පෙර):**
1. ඔබේම **domain** එකක් ගන්න (උදා: `innovativeict.lk`). ~$10-15/වසර.
2. Transactional email සේවාවක් (Brevo, Resend, Mailgun, Amazon SES... නිදහස් plan ඇත; වත්මන් සීමා බලන්න) සමඟ ගිණුමක් සාදා ඔබේ domain එක එක් කරන්න.
3. ඔවුන් දෙන **SPF, DKIM** (සහ **DMARC**) DNS records ඔබේ domain DNS (Cloudflare) හි එක් කරන්න. "Verified" ලෙස පෙනෙන තුරු රැඳී සිටින්න.
4. Vercel env: `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM=noreply@ඔබේ-domain`, (විකල්ප) `MAIL_REPLY_TO`. මේවා සකසා ඇත්නම් Gmail වෙනුවට SMTP භාවිතා වේ.
5. නැවත Show original හි SPF/DKIM/DMARC PASS සහ **From domain = DKIM domain** බව තහවුරු කරන්න.

**අමතර දේවල්:**
- `APP_URL` **සැබෑ https domain** එක විය යුතුයි. `localhost`, IP ලිපින, හෝ තාවකාලික (ngrok වැනි) link ඇති email spam ලෙස සලකනු ලැබේ.
- Pilot සිසුන්ට: "Not spam" ලෙස සලකුණු කර `From` ලිපිනය contacts වලට එක් කරන්න. ඒ ගිණුම් සඳහා පමණක් උපකාරී වේ.
- එකවර සිසුන් සියල්ලන්ට නොව ක්‍රමයෙන් යවන්න (අලුත් domain එකට reputation ගොඩනැගීමට දින කිහිපයක් ගත වේ).
- ලියාපදිංචි පිටුවේ "email එක spam folder එක ද පරීක්ෂා කරන්න" යන සටහන සිසුන්ට පෙන්වන්න.

## C. සැබෑ පරිසරයේ පරීක්ෂා (මම sandbox එකෙන් කළ නොහැකි දේ)

- [ ] **සැබෑ email:** ලියාපදිංචිය → තහවුරු කේතය → index email → මුරපදය අමතක වීම → මුරපදය වෙනස් කිරීම. Gmail, Outlook, Yahoo හි spam folder එකට යන්නේද බලන්න.
- [ ] **සැබෑ AI:** ICT මිතුරා (ප්‍රශ්න, ඡායාරූපය, PDF) සහ admin සහායක. සිංහල පිළිතුරු ගුණාත්මකභාවය.
- [ ] **සැබෑ දුරකථන:** Android Chrome සහ **iPhone Safari**, මන්දගාමී mobile data (3G/4G) මත, පිටු වේගය සහ upload.
- [ ] **සම්පූර්ණ ගමන:** ලියාපදිංචිය → පාඩම් → පැවරුම් upload → Quiz → Zoom ලින්ක් → දැනුම්දීම්.
- [ ] **Turnstile** සැබෑ key වලින් login/register ක්‍රියා කරයි.
- [ ] **දෝෂ නිරීක්ෂණය:** Vercel Logs බලන ක්‍රමය දැන ගන්න; (ඉල්ලුවොත් Sentry නිදහස් plan එකක් එක් කළ හැක.)
- [ ] **Uptime monitor:** UptimeRobot (නිදහස්) මගින් `/api/health` සෑම විනාඩි 5කට.

## Load test (සිසුන් 500-1,000 එකවර)

> ⚠️ **Production database එකට කිසිවිටක් නොයොදන්න.** මෙය ව්‍යාජ සිසුන් සාදා මකයි. වෙනම **staging** එකක් භාවිතා කරන්න.

**1. Staging සාදන්න (විනාඩි 10ක්)**
- Neon හි **branch** එකක් සාදන්න (Branches → Create; production DB එකේ පිටපතක් මිල අඩුවෙන්) හෝ වෙනම නිදහස් project එකක්.
- Vercel හි **Preview deployment** එකක් (වෙනම branch එකක් push කරන්න) හෝ දෙවන Vercel project එකක්. එහි `DATABASE_URL` = staging Neon (pooled). වෙනත් env vars production වලම විය හැක, **ඒත් AI keys සහ SMTP එක නොදැමීම/mock කිරීම** වඩා හොඳයි (ගාස්තු වළක්වා ගැනීමට).
- Staging DB එකට `npm run db:migrate` සහ `npm run db:seed` ධාවනය කරන්න.

**2. ධාවනය (ඔබේ පරිගණකයෙන්)**
```bash
LOADTEST_URL="https://ඔබේ-staging-url" DATABASE_URL="<STAGING Neon string>" \
  npm run loadtest -- --vus 100 --duration 60 --yes
```
`--vus` = එකවර සිසුන් ගණන, `--duration` = තත්පර, `--ramp` = සිසුන් ආරම්භ වීමට ගතවන තත්පර (පෙරනිමි 15).
Windows PowerShell හිදී: `$env:LOADTEST_URL="..."; $env:DATABASE_URL="..."; npm run loadtest -- --vus 100 --duration 60 --yes`

**3. අදියරෙන් අදියර ඉහළ දමන්න:** 100 → 300 → 500 → 1,000. හැම අදියරකටම පසු:
- **දෝෂ % 0 ට ආසන්නද?** (5xx, timeouts)
- **p95 latency** < ~1,500ms ද? (ප්‍රමාණවත්; p99 ඊට වඩා වැඩි විය හැක)
- Vercel → Logs / Observability හි errors; Neon → Monitoring හි **connections** සහ CPU. Connection ගණන සීමාවට ළං වේ නම් pooled string එක භාවිතා වේදැයි බලන්න, `src/db/index.ts` හි `max` අඩු කරන්න.

**4. එකවර login (පන්තිය ආරම්භයේ ගැටලුව):** මෙම script එක login නොකරයි (session කෙලින්ම සාදයි). Login surge එක පරීක්ෂා කිරීමට සැබෑ ගිණුම් 50-100ක් සහිත ඔබේ සගයන් / සිසුන් කිහිප දෙනෙකු සමඟ එකවර login වී බලන්න, හෝ අවශ්‍ය නම් මට ඒ සඳහා script එකක් එක් කරන්නැයි කියන්න.

**5. AI:** AI (ICT මිතුරා) මෙයින් පරීක්ෂා නොවේ. provider එකේ quota (මිනිත්තුවට ඉල්ලීම්) ඉක්මවීම ඔබට dashboard එකෙන් නිරීක්ෂණය කළ යුතුයි; 20-30 දෙනෙකු සමඟ සැබෑ පරීක්ෂාවක් කර වියදම/දෝෂ බලන්න.

**6. අවසානයේ:** staging Neon branch / project එක මකන්න (ඉතිරි ව්‍යාජ දත්ත නැති බව; script එක ඒවා මකයි).

## D. නීතිමය / පෞද්ගලිකත්වය

- [x] **ළමයින්ගේ දත්ත:** ලියාපදිංචි පෝරමයේ "පෞද්ගලිකත්ව ප්‍රතිපත්තියට එකඟ වෙමි / වයස 18ට අඩු නම් දෙමාපිය අවසරය ඇත" checkbox එක අනිවාර්යයි (client + server). එකඟ වූ වේලාව සහ ප්‍රතිපත්ති අනුවාදය `users.consent_at` / `users.consent_version` හි සටහන් වේ (migration `0023`; ඔබේ production DB එකට `npm run db:migrate` ධාවනය කරන්න).
- [x] **පෞද්ගලිකත්ව ප්‍රතිපත්ති පිටුව:** `/privacy` (සිංහල + English, login නොකර පෙනේ; landing page, login/register, cookies පිටු වලින් සබැඳි ඇත). අන්තර්ගතය `src/lib/privacy-content.ts` හි.
- [ ] **ප්‍රතිපත්තිය නීතිඥයෙකුගෙන් පරීක්ෂා කරවන්න** (ශ්‍රී ලංකාවේ පුද්ගල දත්ත ආරක්ෂණ පනත (2022 අංක 9) ඔබේ සේවාවට අදාළ වන ආකාරය, රඳවා ගැනීමේ කාලය, backup කාලය). ප්‍රතිපත්තිය වෙනස් කළ විට `PRIVACY_VERSION` (`src/lib/constants.ts`) යාවත්කාලීන කරන්න.
- [ ] **ප්‍රතිපත්තියේ සත්‍යතාව තහවුරු කරන්න:** ඔබ සැබෑවටම භාවිතා කරන සේවා (hosting, DB, ගොනු ගබඩාව, email, AI) ප්‍රතිපත්තියේ ලැයිස්තුවට ගැළපෙන්නේදැයි සහ සම්බන්ධතා විස්තර (`CONTACT`) නිවැරදිදැයි බලන්න.
- [ ] **AI සපයන්නාට යන දත්ත:** Gemini **free tier** හි දත්ත ආකෘති පුහුණුවට භාවිතා වීමට ඉඩ ඇත. සිසුන්ගේ පණිවිඩ/ඡායාරූප යවන නිසා **paid tier** (දත්ත පුහුණුවට නොයන) තෝරන්න, නැතහොත් Anthropic API (පෙරනිමියෙන් පුහුණුවට නොගනී) භාවිතා කරන්න. (පෞද්ගලිකත්ව ප්‍රතිපත්තිය Anthropic API ලෙස ලියා ඇත; වෙනත් සපයන්නෙකු භාවිතා කරන්නේ නම් එය යාවත්කාලීන කරන්න.)
- [ ] පරණ පරිශීලකයන්ට (consent_at හිස්) නව ප්‍රතිපත්තිය පෙන්වීමට අවශ්‍ය නම් (pilot සිසුන් ලියාපදිංචි වී තිබේ නම්) ඔවුන්ගෙන් අලුතින් කැමැත්ත ලබාගන්න.

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

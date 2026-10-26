// Load test (STAGING පරීක්ෂණ පරිසරයක් සඳහා පමණි; production එකට කිසිවිටක් නොයොදන්න).
//
//   LOADTEST_URL=https://staging.example.com DATABASE_URL=<STAGING db> \
//     npm run loadtest -- --vus 300 --duration 120 --yes
//
// ක්‍රියාකාරිත්වය: staging DB එකේ ව්‍යාජ සිසුන් N දෙනෙක් + session සාදයි → සැබෑ සිසුන් මෙන් පිටු (dashboard, පැවරුම්,
// quiz, ...) අහඹු ලෙස බලයි → latency (p50/p95/p99), දෝෂ සහ status codes වාර්තා කරයි → ව්‍යාජ දත්ත මකයි.
// AI (Sage) ඇමතුම් මෙයින් නොයැවේ (වියදම් නිසා). Login burst එක වෙනම පරීක්ෂා කරන්න.
import "./env";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

const arg = (name: string, def?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const URL_ = (process.env.LOADTEST_URL ?? "").replace(/\/$/, "");
const DB = process.env.DATABASE_URL ?? "";
const VUS = Number(arg("vus", "100"));
const DURATION = Number(arg("duration", "60"));
const RAMP = Number(arg("ramp", "15")); // VU සියල්ල ආරම්භ වීමට ගතවන තත්පර
const EMAIL_DOMAIN = "loadtest.invalid";
const PAGES = ["/dashboard", "/dashboard/assignments", "/dashboard/quizzes", "/dashboard/community", "/dashboard/agent", "/dashboard/profile", "/api/notifications", "/api/session", "/api/health"];

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!URL_ || !DB) die("LOADTEST_URL සහ DATABASE_URL (STAGING) අවශ්‍යයි.");
  if (!Number.isInteger(VUS) || VUS < 1 || VUS > 5000) die("--vus 1-5000 අතර විය යුතුයි.");
  const dbHost = new globalThis.URL(DB).host;
  console.log(`Target: ${URL_}\nDatabase: ${dbHost}\nVUs: ${VUS}, duration: ${DURATION}s`);
  if (!process.argv.includes("--yes")) die("ව්‍යාජ සිසුන් මෙම database එකේ සාදා මකනු ඇත. එය STAGING database එකක් බව තහවුරු කර --yes එක් කර නැවත ධාවනය කරන්න.");

  const pool = new Pool({ connectionString: DB, max: 2 });
  // Production build එකේ cookie නාමය __Host-ict_session; http://localhost මත `npm run dev` භාවිතා කරන්නේ නම් LOADTEST_DEV=1
  const cookieName = process.env.LOADTEST_DEV === "1" ? "ict_session" : "__Host-ict_session";

  await pool.query(`delete from users where email like '%@${EMAIL_DOMAIN}'`);
  const inst = (await pool.query("select id from institutes limit 1")).rows[0]?.id ?? null;
  const tokens: string[] = [];
  for (let from = 0; from < VUS; from += 200) {
    const to = Math.min(VUS, from + 200);
    const uvals: unknown[] = [];
    const uph: string[] = [];
    const svals: unknown[] = [];
    const sph: string[] = [];
    for (let i = from; i < to; i++) {
      const uid = `lt-${i}-${randomBytes(4).toString("hex")}`;
      const tok = randomBytes(32).toString("hex");
      tokens.push(tok);
      const b = uvals.length;
      uph.push(`($${b + 1},$${b + 2},'Load School',$${b + 3},'SINHALA','0771234567',$${b + 4},'x','STUDENT','ACTIVE',now(),$${b + 5})`);
      uvals.push(uid, `Load ${i}`, 9 + (i % 3), `u${i}-${randomBytes(3).toString("hex")}@${EMAIL_DOMAIN}`, inst);
      const c = svals.length;
      sph.push(`(gen_random_uuid()::text,$${c + 1},$${c + 2},now() + interval '1 day')`);
      svals.push(createHash("sha256").update(tok).digest("hex"), uid);
    }
    await pool.query(`insert into users(id,name,school,grade,medium,phone,email,password_hash,role,status,email_verified,institute_id) values ${uph.join(",")}`, uvals);
    await pool.query(`insert into sessions(id,token_hash,user_id,expires_at) values ${sph.join(",")}`, svals);
  }
  console.log(`✓ ව්‍යාජ සිසුන් ${VUS} ක් සාදා ඇත. පරීක්ෂාව ආරම්භයි…`);

  const lat: Record<string, number[]> = Object.fromEntries(PAGES.map((p) => [p, []]));
  const codes: Record<string, number> = {};
  const stopAt = Date.now() + (DURATION + RAMP) * 1000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let stopping = false;
  process.on("SIGINT", () => (stopping = true));

  async function vu(i: number) {
    await sleep(Math.random() * RAMP * 1000);
    while (!stopping && Date.now() < stopAt) {
      const p = PAGES[Math.floor(Math.random() * PAGES.length)];
      const t0 = performance.now();
      let status = "ERR";
      try {
        const r = await fetch(URL_ + p, {
          headers: { cookie: `${cookieName}=${tokens[i]}`, "x-forwarded-for": `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}` },
          redirect: "manual",
          signal: AbortSignal.timeout(60_000),
        });
        await r.arrayBuffer();
        status = String(r.status);
      } catch (e) {
        status = e instanceof Error ? e.name : "ERR";
      }
      lat[p].push(performance.now() - t0);
      codes[status] = (codes[status] ?? 0) + 1;
      await sleep(1000 + Math.random() * 2000); // සිසුවෙකුගේ "කියවීමේ" කාලය
    }
  }
  await Promise.all(Array.from({ length: VUS }, (_, i) => vu(i)));

  const pc = (a: number[], q: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : 0);
  const all = Object.values(lat).flat().sort((x, y) => x - y);
  const total = all.length;
  const bad = Object.entries(codes).filter(([c]) => !/^(200|307|308)$/.test(c)).reduce((s, [, n]) => s + n, 0);
  console.log(`\nඉල්ලීම්: ${total}  (${(total / (DURATION + RAMP)).toFixed(1)} req/s)   දෝෂ/අසාමාන්‍ය: ${bad} (${total ? ((bad / total) * 100).toFixed(2) : 0}%)`);
  console.log("Status codes:", codes);
  console.log(`Latency ms: p50=${pc(all, 0.5).toFixed(0)}  p95=${pc(all, 0.95).toFixed(0)}  p99=${pc(all, 0.99).toFixed(0)}  max=${(all.at(-1) ?? 0).toFixed(0)}`);
  for (const p of PAGES) {
    const a = [...lat[p]].sort((x, y) => x - y);
    console.log(`  ${p.padEnd(28)} n=${String(a.length).padStart(5)}  p50=${pc(a, 0.5).toFixed(0).padStart(6)}  p95=${pc(a, 0.95).toFixed(0).padStart(6)}`);
  }
  await pool.query(`delete from users where email like '%@${EMAIL_DOMAIN}'`);
  await pool.end();
  console.log("\n✓ ව්‍යාජ දත්ත මකා ඇත.");
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));

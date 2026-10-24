// Least privilege: ඇප් එක database එකට සම්බන්ධ වන user ට DROP / ALTER / TRUNCATE වැනි අනතුරුදායක අවසර නොදෙයි.
//
// භාවිතය (OWNER ගිණුමේ DATABASE_URL සමඟ, migrations ධාවනය කළ පසු):
//   1) SQL editor එකේ (Neon console) role එක සාදන්න (මුරපදය ශක්තිමත් එකක්):
//        CREATE ROLE ict_app LOGIN PASSWORD '<ශක්තිමත්-අහඹු-මුරපදය>';
//   2) DATABASE_URL=<owner url> npm run db:least-privilege -- ict_app
//   3) Vercel හි DATABASE_URL = ict_app ගිණුමේ URL එක. Owner URL එක ඔබේ පරිගණකයේ .env.local හි පමණක් (migrate / seed සඳහා).
//
// ප්‍රතිඵලය: ict_app ට පේළි කියවීම/ඇතුළත් කිරීම/සංස්කරණය/මැකීම පමණි (SELECT/INSERT/UPDATE/DELETE).
// audit_logs: INSERT සහ SELECT පමණි (ලොග් වෙනස් කිරීම/මැකීම ඇප් එකටත් කළ නොහැක). අනාගත migrations වලින් සෑදෙන table වලටද එම අවසරම ස්වයංක්‍රීයව ලැබේ.
import "./env";
import { Client } from "pg";

async function main() {
  const role = process.argv[2];
  if (!role || !/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error("භාවිතය: npm run db:least-privilege -- <role-නම>  (ඉංග්‍රීසි කුඩා අකුරු, ඉලක්කම්, _)");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (OWNER ගිණුම) සකසා නැත");

  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const me = (await c.query("select current_user as u, current_database() as d")).rows[0] as { u: string; d: string };
    if (me.u === role) throw new Error("OWNER ගිණුමේ URL එකෙන් ධාවනය කරන්න (ict_app ගිණුමෙන් නොවේ)");
    const exists = (await c.query("select 1 from pg_roles where rolname = $1", [role])).rowCount;
    if (!exists) throw new Error(`role "${role}" නැත. පළමුව: CREATE ROLE ${role} LOGIN PASSWORD '...';`);

    const r = c.escapeIdentifier(role);
    const db = c.escapeIdentifier(me.d);
    const stmts = [
      `REVOKE ALL ON DATABASE ${db} FROM PUBLIC`,
      `GRANT CONNECT ON DATABASE ${db} TO ${r}`,
      `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
      `REVOKE CREATE ON SCHEMA public FROM ${r}`,
      `GRANT USAGE ON SCHEMA public TO ${r}`,
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${r}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${r}`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${r}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${r}`,
      // ආරක්ෂක ලොග් append-only
      `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ${r}`,
    ];
    for (const s of stmts) await c.query(s);
    console.log(`✓ "${role}" ට දැන් ඇත්තේ DML අවසර පමණි (DROP/ALTER/TRUNCATE/CREATE නැත). audit_logs: INSERT/SELECT පමණි.`);
    console.log(`  Vercel හි DATABASE_URL එක "${role}" ගිණුමේ URL එකට මාරු කරන්න.`);
  } finally {
    await c.end();
  }
}
main().then(() => process.exit(0), (e) => { console.error(e.message ?? e); process.exit(1); });

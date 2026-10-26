// Object storage නඩත්තු උපකරණ.  භාවිතය:
//   npm run storage:migrate            Postgres හි ඇති පවතින files (පැවරුම්, ඡායාරූප, Sage) bucket එකට ගෙන යයි (SHA-256 තහවුරු කර, ඉන්පසු Postgres දත්ත ඉවත් කරයි)
//   npm run storage:gc [-- --dry]      කිසිදු row එකකින් යොමු නොකෙරෙන (පරිශීලකයෙකු මැකූ පසු ඉතිරි වූ) objects ඉවත් කරයි (පැය 24ට වඩා පැරණි ඒවා පමණි)
import "./env";
import { createHash } from "node:crypto";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { agentAttachments, submissionFiles, userAvatars } from "../src/db/schema";
import { deleteBlob, listKeys, storageEnabled, storeBlob } from "../src/lib/storage-core";

async function migrate() {
  let moved = 0;
  const jobs = [
    { kind: "submission" as const, rows: await db.select().from(submissionFiles).where(isNull(submissionFiles.storageKey)), set: (id: string, v: object) => db.update(submissionFiles).set(v).where(eq(submissionFiles.id, id)), id: (r: { id: string }) => r.id },
    { kind: "agent" as const, rows: await db.select().from(agentAttachments).where(isNull(agentAttachments.storageKey)), set: (id: string, v: object) => db.update(agentAttachments).set(v).where(eq(agentAttachments.id, id)), id: (r: { id: string }) => r.id },
  ];
  for (const j of jobs) {
    for (const r of j.rows as { id: string; data: Buffer | null; mime: string; sha256?: string | null }[]) {
      if (!r.data) continue;
      if (r.sha256 && createHash("sha256").update(r.data).digest("hex") !== r.sha256) {
        console.error(`SKIP ${j.kind} ${r.id}: sha256 mismatch`);
        continue;
      }
      const b = await storeBlob(j.kind, r.data, r.mime);
      await j.set(r.id, { data: null, storageKey: b.storageKey });
      moved++;
    }
  }
  for (const r of await db.select().from(userAvatars).where(isNull(userAvatars.storageKey))) {
    if (!r.data) continue;
    if (createHash("sha256").update(r.data).digest("hex") !== r.sha256) {
      console.error(`SKIP avatar ${r.userId}: sha256 mismatch`);
      continue;
    }
    const b = await storeBlob("avatar", r.data, r.mime);
    await db.update(userAvatars).set({ data: null, storageKey: b.storageKey }).where(eq(userAvatars.userId, r.userId));
    moved++;
  }
  console.log(`moved ${moved} file(s) to object storage`);
}

async function gc(dry: boolean) {
  const referenced = new Set<string>();
  for (const r of await db.select({ k: submissionFiles.storageKey }).from(submissionFiles).where(isNotNull(submissionFiles.storageKey))) referenced.add(r.k!);
  for (const r of await db.select({ k: agentAttachments.storageKey }).from(agentAttachments).where(isNotNull(agentAttachments.storageKey))) referenced.add(r.k!);
  for (const r of await db.select({ k: userAvatars.storageKey }).from(userAvatars).where(isNotNull(userAvatars.storageKey))) referenced.add(r.k!);
  const cutoff = Date.now() - Number(process.env.STORAGE_GC_MIN_AGE_HOURS ?? 24) * 3600_000;
  let orphans = 0;
  for (const p of ["submission/", "agent/", "avatar/"]) {
    for (const o of await listKeys(p)) {
      if (referenced.has(o.key) || (o.lastModified && o.lastModified.getTime() > cutoff)) continue;
      orphans++;
      console.log(`${dry ? "would delete" : "delete"} ${o.key}`);
      if (!dry) await deleteBlob(o.key);
    }
  }
  console.log(`${orphans} orphan object(s) ${dry ? "found" : "removed"}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL සකසා නැත");
  if (!storageEnabled()) throw new Error("S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY සකසා නැත");
  const cmd = process.argv[2];
  if (cmd === "migrate") await migrate();
  else if (cmd === "gc") await gc(process.argv.includes("--dry"));
  else throw new Error("භාවිතය: tsx scripts/storage.ts migrate | gc [--dry]");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

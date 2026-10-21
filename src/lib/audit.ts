import "server-only";
import { and, asc, desc, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requestContext } from "./request-context";
import { hmac } from "./secrets";

// Accounting: සෑම වැදගත් සිදුවීමක්ම (කවුද, කුමක්, කවදා, කොහෙන්) ලියයි.
// Tamper-evident: සෑම පේළියක්ම පෙර පේළියේ hash සමඟ HMAC මගින් බැඳේ. පේළියක් වෙනස් කිරීම/මකා දැමීම/ඇතුළත් කිරීම
// APP_SECRET නොමැතිව සඟවා ගත නොහැක; Super Admin ට "integrity පරීක්ෂා කරන්න" මගින් තහවුරු කළ හැක.

const GENESIS = "GENESIS";
const LOCK_KEY = 727001; // chain එකට එකවර ලිවීම serialise කිරීමට advisory lock

type Row = {
  id: string;
  seq: number;
  actorId: string | null;
  action: string;
  target: string | null;
  targetId: string | null;
  details: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAtMs: number;
};

function rowHash(prev: string, r: Row) {
  return hmac(
    "audit-chain",
    JSON.stringify([prev, r.id, r.seq, r.actorId, r.action, r.target, r.targetId, r.details, r.ip, r.userAgent, r.createdAtMs]),
  );
}

export async function audit(
  actorId: string | null,
  action: string,
  target?: string,
  details?: string,
  targetId?: string,
) {
  try {
    const ctx = await requestContext();
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
      const [last] = await tx
        .select({ hash: auditLogs.hash })
        .from(auditLogs)
        .where(isNotNull(auditLogs.hash))
        .orderBy(desc(auditLogs.seq))
        .limit(1);
      const prev = last?.hash ?? GENESIS;
      const seqRes = await tx.execute(sql`select nextval(pg_get_serial_sequence('audit_logs','seq')) as seq`);
      const seq = Number((seqRes.rows[0] as { seq: string | number }).seq);
      const createdAt = new Date();
      const row: Row = {
        id: crypto.randomUUID(),
        seq,
        actorId,
        action,
        target: target ?? null,
        targetId: targetId ?? null,
        details: details ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        createdAtMs: createdAt.getTime(),
      };
      await tx.insert(auditLogs).values({
        id: row.id,
        seq,
        actorId: row.actorId,
        action,
        target: row.target,
        targetId: row.targetId,
        details: row.details,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt,
        prevHash: prev,
        hash: rowHash(prev, row),
      });
    });
  } catch (e) {
    // Accounting අසාර්ථක වීම නිසා පරිශීලකයාගේ ක්‍රියාව අවහිර නොකරයි (availability), නමුත් සේවාදායක log එකට ලියයි
    console.error("audit log failed", e);
  }
}

export type ChainReport = { ok: boolean; checked: number; legacy: number; brokenSeq?: number; reason?: string };

// මුළු chain එක නැවත ගණනය කර තහවුරු කරයි
export async function verifyAuditChain(): Promise<ChainReport> {
  let checked = 0;
  let prev = GENESIS;
  let afterSeq = 0;
  const [{ legacy }] = await db.execute(sql`select count(*)::int as legacy from audit_logs where hash is null`).then((r) => r.rows as { legacy: number }[]);
  for (;;) {
    const batch = await db
      .select()
      .from(auditLogs)
      .where(and(isNotNull(auditLogs.hash), gt(auditLogs.seq, afterSeq)))
      .orderBy(asc(auditLogs.seq))
      .limit(1000);
    if (batch.length === 0) break;
    for (const r of batch) {
      if (r.prevHash !== prev) return { ok: false, checked, legacy, brokenSeq: r.seq, reason: "chain link broken (row removed or inserted)" };
      const expect = rowHash(prev, {
        id: r.id,
        seq: r.seq,
        actorId: r.actorId,
        action: r.action,
        target: r.target,
        targetId: r.targetId,
        details: r.details,
        ip: r.ip,
        userAgent: r.userAgent,
        createdAtMs: r.createdAt.getTime(),
      });
      if (expect !== r.hash) return { ok: false, checked, legacy, brokenSeq: r.seq, reason: "row content modified" };
      prev = r.hash!;
      checked++;
      afterSeq = r.seq;
    }
  }
  return { ok: true, checked, legacy };
}

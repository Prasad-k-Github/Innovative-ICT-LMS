import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// File ගබඩාව: S3-ගැළපෙන object storage (Cloudflare R2 / AWS S3 / Backblaze B2 / MinIO) සකසා ඇත්නම් files එහි ගබඩා වේ;
// නැතිනම් (local development) පෙර පරිදි Postgres හි. Bucket එක **private** විය යුතුයි: සියලු downloads මෙම server හරහා
// (අවසර + SHA-256 integrity පරීක්ෂාවෙන් පසු) පමණක් ලබා දෙයි -- bucket URL කිසිවිටක් පරිශීලකයාට නොදෙයි.

export function storageEnabled() {
  return !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID && !!process.env.S3_SECRET_ACCESS_KEY;
}

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1" || !!process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  return client;
}
const bucket = () => process.env.S3_BUCKET!;

export type StoredBlob = { data: Buffer | null; storageKey: string | null };

// Insert කරන row එකට දමන්න ඕන `data` සහ `storageKey` ආපසු දෙයි (object storage සක්‍රීය නම් data = null)
export async function storeBlob(kind: "submission" | "avatar" | "agent", data: Buffer, mime: string): Promise<StoredBlob> {
  if (!storageEnabled()) return { data, storageKey: null };
  const key = `${kind}/${randomUUID()}`;
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: mime, ContentLength: data.length }));
  return { data: null, storageKey: key };
}

export async function readBlob(row: { data: Buffer | null; storageKey: string | null }): Promise<Buffer> {
  if (row.storageKey) {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: row.storageKey }));
    if (!res.Body) throw new Error("storage object has no body");
    return Buffer.from(await res.Body.transformToByteArray());
  }
  if (!row.data) throw new Error("file has no content");
  return row.data;
}

// අසාර්ථක වුවත් ප්‍රධාන ක්‍රියාවලිය නොනවත්වයි (ඉතිරි object `npm run storage:gc` මගින් ඉවත් වේ)
export async function deleteBlob(storageKey: string | null | undefined) {
  if (!storageKey || !storageEnabled()) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }));
  } catch (e) {
    console.error("storage delete failed", storageKey, e);
  }
}

export async function listKeys(prefix: string): Promise<{ key: string; lastModified?: Date }[]> {
  const out: { key: string; lastModified?: Date }[] = [];
  let token: string | undefined;
  do {
    const res = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents ?? []) if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

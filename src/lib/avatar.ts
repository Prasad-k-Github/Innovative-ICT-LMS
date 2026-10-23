import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { userAvatars } from "@/db/schema";

export const AVATAR_MAX_BYTES = 400 * 1024; // client එක 256px JPEG (~30KB) ලෙස කුඩා කරයි; server එකේ ඉහළ සීමාව

// Magic bytes මගින් සැබෑ ආකෘතිය හඳුනාගනී (නම/MIME ඇදහිය නොහැකි නිසා)
export function detectImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

// <img src> සඳහා URL (v = cache බිඳීමට updatedAt)
export const avatarSrc = (userId: string, updatedAt: Date | string | number) => `/api/avatar/${userId}?v=${new Date(updatedAt).getTime()}`;

// Privacy: ඡායාරූපය බැලිය හැක්කේ (1) Admin ලාට, (2) හිමිකරුට, (3) ගුරුවරුන්ගේ (Admin ගිණුම්) ඡායාරූප සිසුන්ට. සිසුන් (වයස 18ට අඩු) එකිනෙකාගේ ඡායාරූප නොපෙනේ.
export type AvatarViewer = { id: string; role: string };
export function canSeeAvatar(viewer: AvatarViewer | null | undefined, target: { id: string; role: string }) {
  if (!viewer) return false;
  return viewer.role !== "STUDENT" || viewer.id === target.id || target.role !== "STUDENT";
}

// එක් පරිශීලකයෙකුට ඡායාරූපයක් ඇත්නම් එහි URL (නැත්නම් null)
export async function avatarUrlOf(userId: string): Promise<string | null> {
  const [r] = await db.select({ at: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, userId)).limit(1);
  return r ? avatarSrc(userId, r.at) : null;
}

// පරිශීලකයන් කිහිපයකගේ ඡායාරූප URL එකවර (ඡායාරූපයක් ඇත්තන් පමණක් Map එකේ). Admin පිටු ලැයිස්තු සඳහා
export async function avatarMap(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const rows = await db.select({ id: userAvatars.userId, at: userAvatars.updatedAt }).from(userAvatars).where(inArray(userAvatars.userId, uniq));
  return new Map(rows.map((r) => [r.id, avatarSrc(r.id, r.at)]));
}

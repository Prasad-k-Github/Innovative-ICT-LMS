"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { userAvatars } from "@/db/schema";
import { audit } from "@/lib/audit";
import { AVATAR_MAX_BYTES, detectImage } from "@/lib/avatar";
import { localized } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import type { FormState } from "@/lib/validators";

// ඕනෑම පරිශීලකයෙකුට (සිසුවා / Admin) තමාගේ ඡායාරූපය පමණක් වෙනස් කළ හැක. id සෑම විටම session එකෙන් ගනී.

async function updateAvatarImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  if (!(await rateLimit(`avatar:${me.id}`, 15, 10 * 60_000))) return { error: "උත්සාහ ගණන වැඩියි. විනාඩි කිහිපයකට පසු නැවත උත්සාහ කරන්න." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "ඡායාරූපයක් තෝරන්න." };
  if (file.size > AVATAR_MAX_BYTES) return { error: "ඡායාරූපය විශාලයි (උපරිම 400KB)." };
  const data = Buffer.from(await file.arrayBuffer());
  const mime = detectImage(data);
  if (!mime) return { error: "JPG, PNG හෝ WebP ඡායාරූපයක් පමණක් තෝරන්න." };

  const sha256 = createHash("sha256").update(data).digest("hex");
  await db
    .insert(userAvatars)
    .values({ userId: me.id, mime, size: data.length, sha256, data })
    .onConflictDoUpdate({ target: userAvatars.userId, set: { mime, size: data.length, sha256, data, updatedAt: new Date() } });
  await audit(me.id, "profile.avatar_update", undefined, undefined, me.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "ඡායාරූපය සුරකින ලදී." };
}

async function removeAvatarImpl(): Promise<FormState> {
  const me = await requireUser();
  await db.delete(userAvatars).where(eq(userAvatars.userId, me.id));
  await audit(me.id, "profile.avatar_remove", undefined, undefined, me.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "ඡායාරූපය ඉවත් කරන ලදී." };
}

export async function updateAvatarAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await updateAvatarImpl(prev, formData));
}
export async function removeAvatarAction(): Promise<FormState> {
  return localized(await removeAvatarImpl());
}

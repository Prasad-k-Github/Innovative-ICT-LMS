"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { classLinks, institutes } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { CLASS_LINK_HOURS } from "@/lib/constants";
import { localized } from "@/lib/i18n/server";
import { notifyStudentsFor } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";
import { classLinkSchema, valuesFrom, type FormState } from "@/lib/validators";

// Online පන්ති Zoom links: Admin සහ Super Admin දෙදෙනාටම. සෑම action එකක්ම requireAdmin() සමඟ පරීක්ෂා කරයි.

const refresh = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
};

async function createClassLinkImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const parsed = classLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values };
  const d = parsed.data;

  let instituteId: string | null = null;
  if (d.instituteId) {
    const [i] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, d.instituteId)).limit(1);
    if (!i) return { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values };
    instituteId = i.id;
  }

  const expiresAt = new Date(Date.now() + CLASS_LINK_HOURS * 3_600_000); // එක් කළ මොහොතේ සිට පැය 24ක්
  await db.insert(classLinks).values({ title: d.title, note: d.note, url: d.url, grade: d.grade, medium: d.medium, instituteId, createdBy: admin.id, expiresAt });
  await audit(admin.id, "class.create", d.title);
  await notifyStudentsFor({ grade: d.grade, medium: d.medium, instituteId }, "CLASS_LINK_NEW", { title: d.title });
  refresh();
  redirect("/admin/classes?notice=created");
}

export async function createClassLinkAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await createClassLinkImpl(prev, formData));
}

export async function deleteClassLinkAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/classes");
  const rows = await db.delete(classLinks).where(eq(classLinks.id, id)).returning({ title: classLinks.title });
  if (rows[0]) await audit(admin.id, "class.delete", rows[0].title);
  refresh();
  redirect("/admin/classes?notice=deleted");
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { institutes, newsletters } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { localized } from "@/lib/i18n/server";
import { notifyStudentsMatching } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";
import { newsletterSchema, valuesFrom, type FormState } from "@/lib/validators";

// පන්ති පුවත්පත්‍රිකා: Admin සහ Super Admin දෙදෙනාටම. සෑම action එකක්ම requireAdmin() සමඟ පරීක්ෂා කරයි.

const refresh = () => {
  revalidatePath("/admin/newsletters");
  revalidatePath("/dashboard", "layout");
};

type Medium = "SINHALA" | "ENGLISH";

type Draft = { title: string; summary: string; body: string; grade: number | null; medium: Medium | null; instituteId: string | null };
type Parsed = { error: FormState; d?: undefined; publish?: undefined } | { error?: undefined; d: Draft; publish: boolean };

async function parseForm(formData: FormData): Promise<Parsed> {
  const values = valuesFrom(formData);
  const parsed = newsletterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values } };
  const d = parsed.data;
  let instituteId: string | null = null;
  if (d.instituteId) {
    const [i] = await db.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, d.instituteId)).limit(1);
    if (!i) return { error: { fieldErrors: { instituteId: ["ආයතනය තෝරන්න"] }, values } };
    instituteId = i.id;
  }
  const publish = formData.get("intent")?.toString() !== "draft"; // "කෙටුම්පතක් ලෙස සුරකින්න" බොත්තම පමණක් intent=draft යවයි
  return { d: { title: d.title, summary: d.summary, body: d.body, grade: d.grade ? Number(d.grade) : null, medium: (d.medium || null) as Medium | null, instituteId }, publish };
}

async function notifyPublished(n: { id: string; title: string; grade: number | null; medium: Medium | null; instituteId: string | null }) {
  await notifyStudentsMatching({ grade: n.grade, medium: n.medium, instituteId: n.instituteId }, "NEWSLETTER_NEW", { id: n.id, title: n.title });
}

async function createNewsletterImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const r = await parseForm(formData);
  if (r.error) return r.error;
  const now = new Date();
  const [row] = await db
    .insert(newsletters)
    .values({ ...r.d, published: r.publish, publishedAt: r.publish ? now : null, createdBy: admin.id })
    .returning({ id: newsletters.id });
  await audit(admin.id, r.publish ? "newsletter.publish" : "newsletter.create", r.d.title.slice(0, 100), undefined, row.id);
  if (r.publish) await notifyPublished({ id: row.id, ...r.d });
  refresh();
  redirect(`/admin/newsletters?notice=${r.publish ? "published" : "saved"}`);
}

async function updateNewsletterImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/newsletters");
  const r = await parseForm(formData);
  if (r.error) return r.error;
  const [cur] = await db.select({ published: newsletters.published }).from(newsletters).where(eq(newsletters.id, id)).limit(1);
  if (!cur) redirect("/admin/newsletters");
  const firstPublish = r.publish && !cur.published;
  await db
    .update(newsletters)
    .set({ ...r.d, updatedAt: new Date(), ...(r.publish ? { published: true, ...(firstPublish ? { publishedAt: new Date() } : {}) } : {}) })
    .where(eq(newsletters.id, id));
  await audit(admin.id, firstPublish ? "newsletter.publish" : "newsletter.update", r.d.title.slice(0, 100), undefined, id);
  if (firstPublish) await notifyPublished({ id, ...r.d });
  refresh();
  revalidatePath(`/dashboard/newsletter/${id}`);
  redirect(`/admin/newsletters?notice=${firstPublish ? "published" : "saved"}`);
}

export async function createNewsletterAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await createNewsletterImpl(prev, formData));
}

export async function updateNewsletterAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await updateNewsletterImpl(prev, formData));
}

// පළ කිරීම / සැඟවීම (පළමු වරට පළ කරන විට සිසුන්ට දැනුම් දෙයි)
export async function toggleNewsletterAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/newsletters");
  const [cur] = await db.select().from(newsletters).where(eq(newsletters.id, id)).limit(1);
  if (!cur) redirect("/admin/newsletters");
  if (cur.published) {
    await db.update(newsletters).set({ published: false, updatedAt: new Date() }).where(eq(newsletters.id, id));
    await audit(admin.id, "newsletter.unpublish", cur.title.slice(0, 100), undefined, id);
  } else {
    const firstTime = !cur.publishedAt;
    await db.update(newsletters).set({ published: true, publishedAt: firstTime ? new Date() : cur.publishedAt, updatedAt: new Date() }).where(eq(newsletters.id, id));
    await audit(admin.id, "newsletter.publish", cur.title.slice(0, 100), undefined, id);
    if (firstTime) await notifyPublished({ id, title: cur.title, grade: cur.grade, medium: cur.medium, instituteId: cur.instituteId });
  }
  refresh();
  revalidatePath(`/dashboard/newsletter/${id}`);
  redirect("/admin/newsletters");
}

export async function deleteNewsletterAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/newsletters");
  const rows = await db.delete(newsletters).where(eq(newsletters.id, id)).returning({ title: newsletters.title });
  if (rows[0]) await audit(admin.id, "newsletter.delete", rows[0].title.slice(0, 100), undefined, id);
  refresh();
  redirect("/admin/newsletters?notice=deleted");
}

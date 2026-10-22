"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { localized } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/session";
import { testimonialSchema, valuesFrom, type FormState } from "@/lib/validators";

// Landing page testimonials: Admin සහ Super Admin දෙදෙනාටම. සෑම action එකක්ම requireAdmin() සමඟ පරීක්ෂා කරයි.

const refresh = () => {
  revalidatePath("/");
  revalidatePath("/admin/testimonials");
};

async function createTestimonialImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const parsed = testimonialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values };
  const d = parsed.data;
  const published = formData.get("published") === "on";
  await db.insert(testimonials).values({ authorName: d.authorName, authorInfo: d.authorInfo, quote: d.quote, published, createdBy: admin.id });
  await audit(admin.id, "testimonial.create", d.authorName.slice(0, 100));
  refresh();
  redirect("/admin/testimonials?notice=created");
}

async function updateTestimonialImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = valuesFrom(formData);
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/testimonials");
  const parsed = testimonialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values };
  const d = parsed.data;
  const rows = await db
    .update(testimonials)
    .set({ authorName: d.authorName, authorInfo: d.authorInfo, quote: d.quote, published: formData.get("published") === "on", updatedAt: new Date() })
    .where(eq(testimonials.id, id))
    .returning({ id: testimonials.id });
  if (!rows[0]) redirect("/admin/testimonials");
  await audit(admin.id, "testimonial.update", d.authorName.slice(0, 100));
  refresh();
  redirect("/admin/testimonials?notice=updated");
}

export async function createTestimonialAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await createTestimonialImpl(prev, formData));
}

export async function updateTestimonialAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await updateTestimonialImpl(prev, formData));
}

// Landing page එකේ පෙන්වීම / සැඟවීම මාරු කරයි
export async function toggleTestimonialAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/testimonials");
  const show = formData.get("show") === "1";
  const rows = await db
    .update(testimonials)
    .set({ published: show, updatedAt: new Date() })
    .where(eq(testimonials.id, id))
    .returning({ name: testimonials.authorName });
  if (rows[0]) await audit(admin.id, show ? "testimonial.show" : "testimonial.hide", rows[0].name.slice(0, 100));
  refresh();
  redirect(`/admin/testimonials?notice=${show ? "shown" : "hidden"}`);
}

export async function deleteTestimonialAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/testimonials");
  const rows = await db.delete(testimonials).where(eq(testimonials.id, id)).returning({ name: testimonials.authorName });
  if (rows[0]) await audit(admin.id, "testimonial.delete", rows[0].name.slice(0, 100));
  refresh();
  redirect("/admin/testimonials?notice=deleted");
}

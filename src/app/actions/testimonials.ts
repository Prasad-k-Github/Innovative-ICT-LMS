"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { UUID_RE } from "@/lib/assessment";
import { audit } from "@/lib/audit";
import { gradeLabel } from "@/lib/constants";
import { localized } from "@/lib/i18n/server";
import { notifyAdmins, notifyUsers } from "@/lib/notify";
import { requireAdmin, requireStudent } from "@/lib/session";
import { studentTestimonialSchema, testimonialSchema, valuesFrom, type FormState } from "@/lib/validators";

// Landing page testimonials: Admin සහ Super Admin දෙදෙනාටම. සෑම action එකක්ම requireAdmin() සමඟ පරීක්ෂා කරයි.

const refresh = () => {
  revalidatePath("/");
  revalidatePath("/admin/testimonials");
  revalidatePath("/dashboard/feedback");
};

const MAX_PER_STUDENT = 5;

// පෙන්වන නම: මුල් නම පමණි, නැත්නම් මුල් අකුරු (K. P.). සම්පූර්ණ නම කිසිවිටෙක landing page එකට නොයයි
function displayName(full: string, style: "first" | "initials") {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "-";
  if (style === "first") return parts[0].slice(0, 40);
  return parts.map((p) => `${Array.from(p)[0]}.`).join(" ").slice(0, 40);
}

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
  const [cur] = await db.select({ status: testimonials.status }).from(testimonials).where(eq(testimonials.id, id)).limit(1);
  if (!cur) redirect("/admin/testimonials");
  // අනුමත කර නැති (PENDING) අදහසක පෙළ පමණක් වෙනස් කළ හැක: පෙන්වීම තීරණය වන්නේ approve කිරීමෙනි
  const rows = await db
    .update(testimonials)
    .set({
      authorName: d.authorName,
      authorInfo: d.authorInfo,
      quote: d.quote,
      ...(cur.status === "PENDING"
        ? {}
        : formData.get("published") === "on"
          ? { published: true, status: "APPROVED" }
          : { published: false }),
      updatedAt: new Date(),
    })
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
    .where(and(eq(testimonials.id, id), eq(testimonials.status, "APPROVED"))) // අනුමත නොකළ ඒවා පෙන්වන්නේ approve කිරීමෙන් පමණි
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

/* ------------------------- සිසුන්ගේ අදහස් (අනුමැතියෙන් පසු පමණක් පෙන්වයි) ------------------------- */

async function submitTestimonialImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireStudent();
  const values = valuesFrom(formData);
  const parsed = studentTestimonialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>, values };
  const d = parsed.data;

  const [{ total }] = await db.select({ total: count() }).from(testimonials).where(eq(testimonials.submittedBy, me.id));
  if (total >= MAX_PER_STUDENT) return { error: "ඔබට එවිය හැකි උපරිම අදහස් ගණන ඉක්මවා ඇත. පැරණි එකක් ඉවත් කර නැවත උත්සාහ කරන්න.", values };
  const [{ waiting }] = await db
    .select({ waiting: count() })
    .from(testimonials)
    .where(and(eq(testimonials.submittedBy, me.id), eq(testimonials.status, "PENDING")));
  if (waiting > 0) return { error: "ඔබගේ පෙර අදහස තවම අනුමැතිය බලාපොරොත්තුවෙන් සිටී. එය සමාලෝචනය කළ පසු නව එකක් එවන්න.", values };

  const authorName = displayName(me.name, d.nameStyle);
  const authorInfo = formData.get("showGrade") === "on" ? gradeLabel(me.grade, me.alYear) : "";
  await db.insert(testimonials).values({ authorName, authorInfo, quote: d.quote, published: false, status: "PENDING", submittedBy: me.id });
  await audit(me.id, "testimonial.submit", authorName, undefined, me.id);
  await notifyAdmins("TESTIMONIAL_NEW", { name: me.name });
  refresh();
  redirect("/dashboard/feedback?notice=sent");
}

export async function submitTestimonialAction(prev: FormState, formData: FormData): Promise<FormState> {
  return localized(await submitTestimonialImpl(prev, formData));
}

// සිසුවාට තමන්ගේම අදහසක් ඉවත් කළ හැක (landing page එකෙන්ද ඉවත් වේ)
export async function withdrawTestimonialAction(formData: FormData) {
  const me = await requireStudent();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/dashboard/feedback");
  const rows = await db
    .delete(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.submittedBy, me.id)))
    .returning({ name: testimonials.authorName });
  if (rows[0]) await audit(me.id, "testimonial.withdraw", rows[0].name.slice(0, 100), undefined, me.id);
  refresh();
  redirect("/dashboard/feedback?notice=withdrawn");
}

// Admin: සිසුවෙක් එවූ අදහස අනුමත (landing page එකේ පෙන්වයි) / ප්‍රතික්ෂේප කිරීම
export async function reviewTestimonialAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  if (!UUID_RE.test(id)) redirect("/admin/testimonials");
  const approve = formData.get("decision") === "approve";
  const rows = await db
    .update(testimonials)
    .set({ status: approve ? "APPROVED" : "REJECTED", published: approve, updatedAt: new Date() })
    .where(and(eq(testimonials.id, id), eq(testimonials.status, "PENDING")))
    .returning({ name: testimonials.authorName, by: testimonials.submittedBy });
  if (rows[0]) {
    await audit(admin.id, approve ? "testimonial.approve" : "testimonial.reject", rows[0].name.slice(0, 100));
    if (rows[0].by) await notifyUsers([rows[0].by], approve ? "TESTIMONIAL_APPROVED" : "TESTIMONIAL_REJECTED");
  }
  refresh();
  redirect(`/admin/testimonials?tab=pending&notice=${approve ? "approved" : "rejected"}`);
}

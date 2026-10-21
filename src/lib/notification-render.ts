import { CONTENT_TYPE_LABELS, type ContentType } from "./constants";
import type { T } from "./i18n/core";
import type { IconName } from "@/components/icons";

export type NotificationData = Record<string, string | number | null>;

export const NOTIFICATION_TYPES = [
  // සිසුන්ට
  "ACCOUNT_APPROVED",
  "ACCOUNT_REACTIVATED",
  "LESSON_ADDED",
  "RESOURCE_ADDED",
  "ASSIGNMENT_NEW",
  "ASSIGNMENT_GRADED",
  "QUIZ_NEW",
  "QUIZ_RESET",
  "REQUEST_APPROVED",
  "REQUEST_REJECTED",
  // Admin ලාට
  "STUDENT_REGISTERED",
  "STUDENT_READY",
  "CHANGE_REQUEST_NEW",
  "SUBMISSION_NEW",
  "QUIZ_SUBMITTED",
  "STUDENT_DELETED_SELF",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type RenderedNotification = { title: string; body: string; href: string; icon: IconName };

// සිදුවීම + පරාමිති → පෙන්වන පෙළ (භාෂා මාරුවට අනුව සෑම වාරයකම නැවත සාදයි)
export function renderNotification(type: string, d: NotificationData, t: T): RenderedNotification {
  const s = (k: string) => String(d[k] ?? "");
  switch (type as NotificationType) {
    case "ACCOUNT_APPROVED":
      return { title: t("ඔබගේ ගිණුම අනුමත කරන ලදී"), body: t("දැන් ඔබට සියලු පාඩම් සහ අන්තර්ගතය බලාගත හැක."), href: "/dashboard", icon: "check" };
    case "ACCOUNT_REACTIVATED":
      return { title: t("ඔබගේ ගිණුම නැවත සක්‍රීය කරන ලදී"), body: t("දැන් ඔබට නැවත Login විය හැක."), href: "/dashboard", icon: "check" };
    case "LESSON_ADDED":
      return { title: t("නව පාඩමක් එක් කරන ලදී"), body: s("title"), href: d.id ? `/dashboard/lessons/${s("id")}` : "/dashboard", icon: "book" };
    case "RESOURCE_ADDED": {
      const kind = d.kind as ContentType;
      const label = CONTENT_TYPE_LABELS[kind] ? t(CONTENT_TYPE_LABELS[kind]) : "";
      return { title: t("නව අන්තර්ගතයක් එක් කරන ලදී"), body: [label, s("title")].filter(Boolean).join(" · "), href: d.lessonId ? `/dashboard/lessons/${s("lessonId")}` : "/dashboard", icon: "papers" };
    }
    case "ASSIGNMENT_NEW":
      return { title: t("නව පැවරුමක්"), body: s("title"), href: `/dashboard/assignments/${s("id")}`, icon: "clipboard" };
    case "ASSIGNMENT_GRADED": {
      const score = d.marks !== null && d.marks !== undefined ? ` · ${d.marks}${d.max ? `/${d.max}` : ""}` : "";
      return { title: t("ඔබගේ පැවරුම ලකුණු කරන ලදී"), body: `${s("title")}${score}`, href: `/dashboard/assignments/${s("id")}`, icon: "clipboard" };
    }
    case "QUIZ_NEW":
      return { title: t("නව Quiz එකක්"), body: s("title"), href: `/dashboard/quizzes/${s("id")}`, icon: "quiz" };
    case "QUIZ_RESET":
      return { title: t("ඔබට Quiz එක නැවත කිරීමට අවස්ථාව ලැබුණි"), body: s("title"), href: `/dashboard/quizzes/${s("id")}`, icon: "quiz" };
    case "REQUEST_APPROVED":
      return { title: t("ඔබගේ වෙනස් කිරීමේ ඉල්ලීම අනුමත කරන ලදී"), body: t("ඔබගේ ශ්‍රේණිය / මාධ්‍යය යාවත්කාලීන විය."), href: "/dashboard/profile", icon: "check" };
    case "REQUEST_REJECTED":
      return { title: t("ඔබගේ වෙනස් කිරීමේ ඉල්ලීම ප්‍රතික්ෂේප කරන ලදී"), body: t("වැඩි විස්තර සඳහා ගුරුවරයා අමතන්න."), href: "/dashboard/profile", icon: "inbox" };
    case "STUDENT_REGISTERED":
      return { title: t("නව සිසුවෙක් ලියාපදිංචි විය"), body: s("name"), href: "/admin/students", icon: "users" };
    case "STUDENT_READY":
      return { title: t("සිසුවෙක් අනුමැතිය බලාපොරොත්තුවෙන්"), body: t("{name} Email තහවුරු කර මුරපදය සෑදුවා.", { name: s("name") }), href: `/admin/students/${s("id")}`, icon: "users" };
    case "CHANGE_REQUEST_NEW":
      return { title: t("නව වෙනස් කිරීමේ ඉල්ලීමක්"), body: s("name"), href: "/admin/requests", icon: "inbox" };
    case "SUBMISSION_NEW":
      return { title: t("පැවරුමක් ඉදිරිපත් කරන ලදී"), body: `${s("name")} · ${s("title")}`, href: `/admin/assignments/${s("id")}`, icon: "clipboard" };
    case "QUIZ_SUBMITTED":
      return { title: t("Quiz එකක් සම්පූර්ණ කරන ලදී"), body: `${s("name")} · ${s("title")}`, href: `/admin/quizzes/${s("id")}`, icon: "quiz" };
    case "STUDENT_DELETED_SELF":
      return { title: t("සිසුවෙක් තම ගිණුම මකා දැමීය"), body: s("name"), href: "/admin/students", icon: "users" };
    default:
      return { title: t("නව දැනුම්දීමක්"), body: "", href: "/", icon: "inbox" };
  }
}

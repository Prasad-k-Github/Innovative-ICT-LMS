import "server-only";
import nodemailer from "nodemailer";
import { APP_NAME, INVITE_TOKEN_HOURS, RESET_TOKEN_HOURS, VERIFY_TOKEN_HOURS } from "./constants";

type Mail = { to: string; subject: string; html: string; text: string };

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sendMail(mail: Mail) {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD is not configured");
    }
    // Development: email යවනවා වෙනුවට console එකේ පෙන්වයි
    console.log(`\n[DEV EMAIL] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await t.sendMail({
    from: `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

type Copy = { title: string; body: string; button: string };

// Email සිංහල සහ English දෙකෙන්ම යවයි (ලබන්නාගේ භාෂාව නොදන්නා නිසා)
function layout(greetingSi: string, greetingEn: string, si: Copy, en: Copy, url: string) {
  const block = (g: string, c: Copy) => `<h3 style="margin:0 0 12px">${g}</h3>
  <p style="line-height:1.6;margin:0 0 8px"><strong>${c.title}</strong></p>
  <p style="line-height:1.6;margin:0">${c.body}</p>`;
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1E293B">
  <h2 style="color:#2563EB;margin:0 0 16px">${APP_NAME}</h2>
  ${block(greetingSi, si)}
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:20px 0">
  ${block(greetingEn, en)}
  <p style="margin:24px 0"><a href="${url}" style="background:#2563EB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${si.button} / ${en.button}</a></p>
  <p style="font-size:12px;color:#64748B;line-height:1.5">බොත්තම ක්‍රියා නොකරන්නේ නම් මෙම link එක browser එකට copy කරන්න / If the button does not work, copy this link into your browser:<br>${url}</p>
</div>`;
}

function send(to: string, name: string, subject: string, si: Copy, en: Copy, url: string, hours?: number) {
  const n = escapeHtml(name);
  return sendMail({
    to,
    subject,
    html: layout(`ආයුබෝවන් ${n},`, `Hello ${n},`, si, en, url),
    text: `ආයුබෝවන් ${name},\n${si.title}\n${si.button}: ${url}${hours ? `\n(පැය ${hours}ක් වලංගුයි)` : ""}\n\n----\n\nHello ${name},\n${en.title}\n${en.button}: ${url}${hours ? `\n(Valid for ${hours} hours)` : ""}`,
  });
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${appUrl()}/verify-email?token=${token}`;
  await send(
    to,
    name,
    `${APP_NAME} - ඔබගේ email ලිපිනය තහවුරු කරන්න / Verify your email`,
    {
      title: "Email තහවුරු කරන්න",
      body: "ලියාපදිංචි වීම ගැන ස්තූතියි. ඔබගේ email ලිපිනය තහවුරු කිරීමට පහත බොත්තම ඔබන්න; ඉන්පසු ඔබගේ මුරපදය සාදා ගත හැක. මෙම link එක පැය 24ක් වලංගුයි.",
      button: "Email තහවුරු කරන්න",
    },
    {
      title: "Verify your email address",
      body: "Thank you for registering. Press the button below to verify your email address; you will then be asked to create your password. This link is valid for 24 hours.",
      button: "Verify email",
    },
    url,
    VERIFY_TOKEN_HOURS,
  );
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${appUrl()}/reset-password?token=${token}`;
  await send(
    to,
    name,
    `${APP_NAME} - මුරපදය වෙනස් කිරීම / Password reset`,
    {
      title: "මුරපදය වෙනස් කරන්න",
      body: "ඔබගේ මුරපදය වෙනස් කිරීමට ඉල්ලීමක් ලැබුණා. පහත බොත්තම ඔබන්න. මෙම link එක පැය 1ක් වලංගුයි. ඔබ මෙය ඉල්ලුවේ නැත්නම් මෙම email එක නොසලකා හරින්න.",
      button: "මුරපදය වෙනස් කරන්න",
    },
    {
      title: "Reset your password",
      body: "We received a request to reset your password. Press the button below. This link is valid for 1 hour. If you did not request this, please ignore this email.",
      button: "Reset password",
    },
    url,
    RESET_TOKEN_HOURS,
  );
}

// Admin විසින් සාදන ලද ගිණුමක් සඳහා: සිසුවා තනිවම මුරපදය සකසයි (Admin ට මුරපදය නොදනී)
export async function sendInviteEmail(to: string, name: string, token: string) {
  const url = `${appUrl()}/reset-password?token=${token}`;
  await send(
    to,
    name,
    `${APP_NAME} - ඔබගේ ගිණුම සූදානම් / Your account is ready`,
    {
      title: "මුරපදය සකසන්න",
      body: "ඔබට Innovative ICT හි ගිණුමක් සාදා ඇත. පහත බොත්තම ඔබා ඔබගේම මුරපදයක් සකසන්න. මෙම link එක පැය 72ක් වලංගුයි.",
      button: "මුරපදය සකසන්න",
    },
    {
      title: "Set your password",
      body: "An account has been created for you on Innovative ICT. Press the button below to set your own password. This link is valid for 72 hours.",
      button: "Set password",
    },
    url,
    INVITE_TOKEN_HOURS,
  );
}

// Admin විසින් සිසුවා අනුමත කළ විට දැනුම් දීම
export async function sendApprovalEmail(to: string, name: string) {
  const url = `${appUrl()}/login`;
  await send(
    to,
    name,
    `${APP_NAME} - ඔබගේ ගිණුම අනුමත කරන ලදී / Your account has been approved`,
    {
      title: "ඔබගේ ගිණුම අනුමත කරන ලදී",
      body: "ඔබගේ ලියාපදිංචිය ගුරුවරයා විසින් අනුමත කර ඇත. දැන් Login වී ඔබගේ ශ්‍රේණියට අදාළ පාඩම්, පැවරුම් සහ Quiz බලන්න.",
      button: "Login වන්න",
    },
    {
      title: "Your account has been approved",
      body: "Your registration has been approved by your teacher. You can now log in and access the lessons, assignments and quizzes for your grade.",
      button: "Log in",
    },
    url,
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

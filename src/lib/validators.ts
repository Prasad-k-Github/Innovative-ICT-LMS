import { z } from "zod";
import { isWeakPassword, WEAK_PASSWORD_MESSAGE } from "./password-policy";
import { parseColombo } from "./time";
import { AL_GRADE, ALLOWED_LINK_HOSTS, CONTENT_TYPE_LABELS, GRADES, MEDIUMS, QUIZ_MAX_OPTIONS, QUIZ_MIN_OPTIONS, alExamYears } from "./constants";

// Zod හි default (ඉංග්‍රීසි) පණිවිඩ වෙනුවට: ක්ෂේත්‍රයක් හිස්ව ආවත් / වර්ගය වැරදි වුවත් අපගේ භාෂාවෙන් පෙන්වයි (client සහ server දෙකටම)
z.config({
  customError: (iss) => {
    if (iss.code === "invalid_type") return iss.input === undefined ? "මෙම ක්ෂේත්‍රය අවශ්‍යයි" : "වලංගු අගයක් ඇතුළත් කරන්න";
    return undefined;
  },
});

// +94 / 94 / 0 ආකාර සියල්ල 0XXXXXXXXX ලෙස සාමාන්‍යකරණය කරයි
export function normalizePhone(input: string) {
  const digits = input.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+94")) return "0" + digits.slice(3);
  if (digits.startsWith("94") && digits.length === 11) return "0" + digits.slice(2);
  return digits;
}

const password = z
  .string()
  .min(8, "මුරපදය අවම වශයෙන් අක්ෂර 8ක් විය යුතුයි")
  .max(72, "මුරපදය දිග වැඩියි")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "මුරපදයේ අකුරු සහ ඉලක්කම් දෙකම තිබිය යුතුයි",
  })
  .refine((v) => !isWeakPassword(v), { message: WEAK_PASSWORD_MESSAGE });

// සිසුවෙකුගේ පොදු ක්ෂේත්‍ර (ලියාපදිංචිය සහ Admin සංස්කරණය දෙකටම)
const studentFields = z.object({
  name: z.string().trim().min(2, "නම ඇතුළත් කරන්න").max(100),
  school: z.string().trim().min(2, "පාසල ඇතුළත් කරන්න").max(150),
  grade: z.coerce
    .number({ error: "ශ්‍රේණිය තෝරන්න" })
    .refine((g) => (GRADES as readonly number[]).includes(g), {
      message: "ශ්‍රේණිය තෝරන්න",
    }),
  medium: z.enum(MEDIUMS, { error: "මාධ්‍යය තෝරන්න" }),
  alYear: z.string().optional(),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => /^0\d{9}$/.test(v), {
      message: "වලංගු දුරකතන අංකයක් ඇතුළත් කරන්න (උදා: 0771234567)",
    }),
  email: z.email("වලංගු email ලිපිනයක් ඇතුළත් කරන්න").max(150).transform((v) => v.toLowerCase().trim()),
  instituteId: z.string({ error: "ආයතනය තෝරන්න" }).min(1, "ආයතනය තෝරන්න"),
});

const alYearRule = (d: { grade: number; alYear?: string }) =>
  d.grade !== AL_GRADE || alExamYears().includes(Number(d.alYear));
const alYearIssue = {
  path: ["alYear"],
  message: "උසස් පෙළ විභාගය පැවැත්වෙන වර්ෂය තෝරන්න",
};

// ලියාපදිංචියේදී මුරපදයක් නැත: email තහවුරු කළ පසු වෙනම තිරයකින් සාදයි
export const registerSchema = studentFields.refine(alYearRule, alYearIssue);

// Admin විසින් සිසුවෙකු සෑදීම / සංස්කරණය (මුරපදය නැත)
export const adminStudentSchema = studentFields.refine(alYearRule, alYearIssue);

// සිසුවා තමාගේ විස්තර සංස්කරණය (Email, ශ්‍රේණිය, මාධ්‍යය, ආයතනය මෙහි නැත)
export const profileSchema = z.object({
  name: studentFields.shape.name,
  school: studentFields.shape.school,
  phone: studentFields.shape.phone,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "වත්මන් මුරපදය ඇතුළත් කරන්න"),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "මුරපද දෙක ගැළපෙන්නේ නැහැ",
  });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "මුරපදය ඇතුළත් කරන්න"),
});

// ශ්‍රේණිය / මාධ්‍යය / ආයතනය වෙනස් කිරීමේ ඉල්ලීම
export const changeRequestSchema = z
  .object({
    grade: studentFields.shape.grade,
    medium: studentFields.shape.medium,
    alYear: z.string().optional(),
    instituteId: studentFields.shape.instituteId,
    note: z.string().trim().max(300, "සටහන දිග වැඩියි").optional(),
  })
  .refine(alYearRule, alYearIssue);

// Admin කෙනෙකු සෑදීම / සංස්කරණය (Super Admin විසින්)
export const adminUserSchema = z.object({
  name: studentFields.shape.name,
  email: studentFields.shape.email,
});

export const ownNameSchema = z.object({ name: studentFields.shape.name });

// ---------------- පාඩම් සහ අන්තර්ගතය (Admin) ----------------

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "පාඩමේ නම ඇතුළත් කරන්න").max(200, "නම දිග වැඩියි"),
  order: z.coerce.number({ error: "අංකයක් ඇතුළත් කරන්න" }).int("අංකයක් ඇතුළත් කරන්න").min(0, "අංකය 0 හෝ ඉහළ විය යුතුයි").max(999, "අංකය විශාල වැඩියි").default(0),
});

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS) as [keyof typeof CONTENT_TYPE_LABELS, ...(keyof typeof CONTENT_TYPE_LABELS)[]];

export const resourceSchema = z.object({
  type: z.enum(CONTENT_TYPES, { error: "වර්ගය තෝරන්න" }),
  title: z.string().trim().max(200, "නම දිග වැඩියි").default(""),
  driveUrl: z
    .string()
    .trim()
    .max(2000, "Link එක දිග වැඩියි")
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return u.protocol === "https:" && ALLOWED_LINK_HOSTS.includes(u.hostname);
        } catch {
          return false;
        }
      },
      { message: "වලංගු Google Drive link එකක් ඇතුළත් කරන්න (https://drive.google.com/...)" },
    ),
  year: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d{4}$/.test(v) && Number(v) >= 2000 && Number(v) <= 2100), { message: "වලංගු වර්ෂයක් ඇතුළත් කරන්න (උදා: 2023)" }),
});

// ---------------- පැවරුම් සහ Quiz (Admin) ----------------

const driveUrl = z
  .string()
  .trim()
  .max(2000, "Link එක දිග වැඩියි")
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && ALLOWED_LINK_HOSTS.includes(u.hostname);
      } catch {
        return false;
      }
    },
    { message: "වලංගු Google Drive link එකක් ඇතුළත් කරන්න (https://drive.google.com/...)" },
  );

const dateTime = (msg: string) =>
  z
    .string()
    .refine((v) => parseColombo(v) !== null, { message: msg })
    .transform((v) => parseColombo(v) as Date);

const targetFields = {
  grade: z.coerce.number({ error: "ශ්‍රේණිය තෝරන්න" }).refine((g) => (GRADES as readonly number[]).includes(g), { message: "ශ්‍රේණිය තෝරන්න" }),
  medium: z.enum(MEDIUMS, { error: "මාධ්‍යය තෝරන්න" }),
  instituteId: z.string().optional(), // හිස් = සියලු ආයතන
};

export const assignmentSchema = z.object({
  title: z.string().trim().min(2, "මාතෘකාව ඇතුළත් කරන්න").max(200, "මාතෘකාව දිග වැඩියි"),
  description: z.string().trim().max(5000, "විස්තරය දිග වැඩියි").default(""),
  ...targetFields,
  attachmentUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || driveUrl.safeParse(v).success, { message: "වලංගු Google Drive link එකක් ඇතුළත් කරන්න (https://drive.google.com/...)" }),
  dueAt: dateTime("අවසාන දිනය සහ වේලාව ඇතුළත් කරන්න"),
  maxMarks: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1000), { message: "උපරිම ලකුණු 1 - 1000 අතර විය යුතුයි" }),
});

const zoomUrl = z
  .string()
  .trim()
  .max(2000, "Link එක දිග වැඩියි")
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        const h = u.hostname.toLowerCase();
        return u.protocol === "https:" && !u.username && !u.password && /(^|\.)zoom\.(us|com)$/.test(h);
      } catch {
        return false;
      }
    },
    { message: "වලංගු Zoom link එකක් ඇතුළත් කරන්න (https://zoom.us/j/...)" },
  );

export const classLinkSchema = z.object({
  title: z.string().trim().min(2, "මාතෘකාව ඇතුළත් කරන්න").max(200, "මාතෘකාව දිග වැඩියි"),
  note: z.string().trim().max(500, "සටහන දිග වැඩියි").default(""),
  url: zoomUrl,
  ...targetFields,
});

export const gradeSubmissionSchema = z.object({
  marks: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 1000), { message: "වලංගු ලකුණු ඇතුළත් කරන්න" }),
  feedback: z.string().trim().max(2000, "සටහන දිග වැඩියි").default(""),
});

export const quizSchema = z
  .object({
    title: z.string().trim().min(2, "මාතෘකාව ඇතුළත් කරන්න").max(200, "මාතෘකාව දිග වැඩියි"),
    description: z.string().trim().max(5000, "විස්තරය දිග වැඩියි").default(""),
    ...targetFields,
    opensAt: dateTime("ආරම්භ වන දිනය සහ වේලාව ඇතුළත් කරන්න"),
    closesAt: dateTime("වසන දිනය සහ වේලාව ඇතුළත් කරන්න"),
    durationMinutes: z.coerce.number({ error: "විනාඩි ගණන ඇතුළත් කරන්න" }).int("විනාඩි ගණන ඇතුළත් කරන්න").min(1, "විනාඩි 1 ත් 300 ත් අතර විය යුතුයි").max(300, "විනාඩි 1 ත් 300 ත් අතර විය යුතුයි"),
    revealAnswers: z.string().optional(),
  })
  .refine((d) => d.closesAt.getTime() > d.opensAt.getTime(), { path: ["closesAt"], message: "වසන වේලාව ආරම්භයට පසු විය යුතුයි" });

export const questionSchema = z
  .object({
    text: z.string().trim().min(2, "ප්‍රශ්නය ඇතුළත් කරන්න").max(2000, "ප්‍රශ්නය දිග වැඩියි"),
    options: z.array(z.string().trim().max(500, "පිළිතුර දිග වැඩියි")),
    correct: z.coerce.number({ error: "නිවැරදි පිළිතුර තෝරන්න" }).int("නිවැරදි පිළිතුර තෝරන්න"),
    marks: z.coerce.number({ error: "ලකුණු ඇතුළත් කරන්න" }).int("ලකුණු ඇතුළත් කරන්න").min(1, "ලකුණු 1 ත් 100 ත් අතර විය යුතුයි").max(100, "ලකුණු 1 ත් 100 ත් අතර විය යුතුයි"),
    explanation: z.string().trim().max(2000, "විස්තරය දිග වැඩියි").default(""),
  })
  .superRefine((d, ctx) => {
    const filled = d.options.filter((o) => o.length > 0);
    if (filled.length < QUIZ_MIN_OPTIONS || filled.length > QUIZ_MAX_OPTIONS)
      ctx.addIssue({ code: "custom", path: ["options"], message: "අවම වශයෙන් පිළිතුරු 2ක් ඇතුළත් කරන්න" });
    else if (!d.options[d.correct]) ctx.addIssue({ code: "custom", path: ["correct"], message: "නිවැරදි පිළිතුර තෝරන්න" });
    else if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length)
      ctx.addIssue({ code: "custom", path: ["options"], message: "පිළිතුරු එකිනෙකට වෙනස් විය යුතුයි" });
  });

// ---------------- 2-step verification ----------------

const totpCode = z.string().trim().regex(/^\d{6}$/, "ඉලක්කම් 6ක code එකක් ඇතුළත් කරන්න");
const loginCode = z
  .string()
  .trim()
  .min(1, "Code එක ඇතුළත් කරන්න")
  .refine((v) => /^\d{6}$/.test(v) || /^[0-9a-f]{5}-?[0-9a-f]{5}$/i.test(v), { message: "ඉලක්කම් 6ක code එකක් හෝ recovery code එකක් ඇතුළත් කරන්න" });

// Email තහවුරු කිරීමේ code එක (ලියාපදිංචි වූ පසු)
export const emailCodeSchema = z.object({
  email: z.email("වලංගු email ලිපිනයක් ඇතුළත් කරන්න").transform((v) => v.toLowerCase().trim()),
  code: z.string().trim().regex(/^\d{6}$/, "ඉලක්කම් 6ක code එකක් ඇතුළත් කරන්න"),
});

export const mfaLoginSchema = z.object({ code: loginCode });
export const mfaConfirmSchema = z.object({ code: totpCode });
export const mfaPasswordSchema = z.object({ password: z.string().min(1, "මුරපදය ඇතුළත් කරන්න") });
export const mfaDisableSchema = z.object({ password: z.string().min(1, "මුරපදය ඇතුළත් කරන්න"), code: loginCode });

export const instituteNameSchema = z
  .string()
  .trim()
  .min(2, "ආයතනයේ නම ඇතුළත් කරන්න")
  .max(100, "නම දිග වැඩියි");

export const loginSchema = z.object({
  email: z.email("වලංගු email ලිපිනයක් ඇතුළත් කරන්න").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "මුරපදය ඇතුළත් කරන්න"),
});

export const emailOnlySchema = z.object({
  email: z.email("වලංගු email ලිපිනයක් ඇතුළත් කරන්න").transform((v) => v.toLowerCase().trim()),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "මුරපද දෙක ගැළපෙන්නේ නැහැ",
  });

export type FormState = {
  ok?: boolean;
  n?: number; // submit ගණන (form එක නැවත සකසා අගයන් රඳවා ගැනීමට)
  error?: string;
  code?: "UNVERIFIED" | "PENDING" | "SUSPENDED";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  codes?: string[]; // 2-step recovery codes (එක් වරක් පමණක් පෙන්වයි)
  expiresAt?: number; // Email code එක කල් ඉකුත් වන වේලාව (ms)
  wait?: number; // නැවත යැවීමට ඉතිරි තත්පර
};

// FormData → සරල string object (මුරපද හැර) form එක නැවත පුරවීමට
export function valuesFrom(formData: FormData, omit: string[] = []) {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    // React ඇතුළත් කරන "$ACTION_*" hidden fields ද මග හරියි
    if (typeof v === "string" && !k.startsWith("$") && !omit.includes(k)) out[k] = v;
  }
  return out;
}

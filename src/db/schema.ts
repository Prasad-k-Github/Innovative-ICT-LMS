import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  jsonb,
  uniqueIndex,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// PostgreSQL bytea (සිසුන් උඩුගත කරන files ගබඩා කිරීමට)
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// SUPER_ADMIN = ගුරුවරයා (එකම; Admin ලා කළමනාකරණය කළ හැක). ADMIN = සහායක Admin
export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "ADMIN", "STUDENT"]);

// PENDING   = ලියාපදිංචි වී ඇත, Admin අනුමත කර නැත
// ACTIVE    = අනුමතයි, LMS ප්‍රවේශය ඇත
// SUSPENDED = තාවකාලිකව විසන්ධි කර ඇත
export const statusEnum = pgEnum("account_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
]);

// ඉගැන්වීමේ මාධ්‍යය
export const mediumEnum = pgEnum("medium", ["SINHALA", "ENGLISH"]);

export const contentTypeEnum = pgEnum("content_type", [
  "TEXTBOOK",
  "WORKBOOK",
  "TUTE",
  "ESSAY",
  "PAST_PAPER",
  "MODEL_PAPER",
  "RECORDING",
  "NOTE",
]);

// පාඩම් වර්ගය: LESSON = සාමාන්‍ය පාඩමක් (Tute, පෙළපොත, වැඩපොත... සියලු වර්ග),
// TUTE = "Tutes" (Model Papers, Past Papers, Recordings සහ අමතර Notes පමණක්)
export const lessonKindEnum = pgEnum("lesson_kind", ["LESSON", "TUTE"]);

export const tokenTypeEnum = pgEnum("token_type", [
  "VERIFY_EMAIL",
  "RESET_PASSWORD",
]);

// පැමිණෙන ආයතන: Admin විසින් කලින් තබන dropdown ලැයිස්තුව
export const institutes = pgTable("institutes", {
  id: id(),
  name: text("name").notNull().unique(),
  // Index අංකයේ කොටස (අකුරු / ඉලක්කම් 2-6; අද්විතීයයි). හිස් නම් DB trigger එක නමෙන් සාදයි; Admin ට වෙනස් කළ හැක (පවතින index වලට බලපාන්නේ නැත)
  code: text("code").notNull().default("").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Index අංක අනුක්‍රමික ගණකය (key = කේතය-S/A-වර්ෂය)
export const indexCounters = pgTable("index_counters", {
  key: text("key").primaryKey(),
  n: integer("n").notNull().default(0),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    school: text("school").notNull(),
    grade: integer("grade").notNull(),
    medium: mediumEnum("medium"), // සිසුන්ට පමණි (Admin ට null)
    alYear: integer("al_year"), // උසස් පෙළ (grade 12) සිසුන්ගේ විභාග වර්ෂය
    phone: text("phone").notNull(),
    email: text("email").notNull().unique(),
    // Index අංකය: ආයතන කේතය-S/A-වර්ෂය-අනුක්‍රමික අංකය (උදා: SLA-S-2026-0007). DB trigger එක insert කරන විට සාදයි; කිසිවිටෙක වෙනස් නොවේ
    indexNo: text("index_no").unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("STUDENT"),
    status: statusEnum("status").notNull().default("PENDING"),
    emailVerified: timestamp("email_verified"),
    instituteId: text("institute_id").references(() => institutes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    lastLoginAt: timestamp("last_login_at"),
    // ලියාපදිංචි වන විට පෞද්ගලිකත්ව ප්‍රතිපත්තියට (සහ වයස 18ට අඩු නම් දෙමාපිය/භාරකරුගේ අවසරයට) එකඟ වූ බවට සාක්ෂිය
    consentAt: timestamp("consent_at"),
    consentVersion: text("consent_version"),
    // අත්හිටුවීම: status = SUSPENDED සමඟ. suspendedUntil null = ස්ථිරවම; අගයක් ඇත්නම් එම වේලාවට ස්වයංක්‍රීයව නැවත සක්‍රිය වේ
    suspendedUntil: timestamp("suspended_until"),
    suspendReason: text("suspend_reason"),
    suspendedAt: timestamp("suspended_at"),
    // 2-step verification (TOTP): රහස AES-256-GCM මගින් සංකේතනය කර ගබඩා කරයි
    mfaSecretEnc: text("mfa_secret_enc"),
    mfaEnabledAt: timestamp("mfa_enabled_at"),
    mfaRecoveryHashes: jsonb("mfa_recovery_hashes").$type<string[]>(),
    mfaLastStep: bigint("mfa_last_step", { mode: "number" }), // එකම code එක නැවත භාවිතය (replay) වැළැක්වීමට
    // දෙමාපිය/භාරකරුගේ සම්බන්ධතා: සතිපතා ප්‍රගති සාරාංශය (Email / WhatsApp) යැවීමට. parentOptInAt = දෙමාපියන්ගේ එකඟත්වය සටහන් කළ වේලාව (null = යවන්නේ නැත)
    parentEmail: text("parent_email"),
    parentPhone: text("parent_phone"),
    parentOptInAt: timestamp("parent_opt_in_at"),
    parentSummarySentAt: timestamp("parent_summary_sent_at"),
    // දෙමාපිය Email සාරාංශ නවත්වා ඇත (දෙමාපියන් unsubscribe කළ විට). parent email වෙනස් කළ විට ඉවත් වේ
    parentUnsubscribedAt: timestamp("parent_unsubscribed_at"),
    // Onboarding: Admin සාදන සිසුවාට තාවකාලික මුරපදයක් (කල් ඉකුත් වේලාව සමඟ). පළමු login එකේදී තමන්ගේම මුරපදයක් සෑදිය යුතුයි
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    tempPasswordExpiresAt: timestamp("temp_password_expires_at"),
    // Email ලිපිනය සැබවින්ම සිසුවා විසින් code එකෙන් තහවුරු කළ වේලාව (Admin සාදන ගිණුම් වල මුලින් null)
    emailConfirmedAt: timestamp("email_confirmed_at"),
  },
  (t) => [index("users_role_status_idx").on(t.role, t.status), index("users_grade_idx").on(t.grade)],
);

// Database sessions: Admin ට suspend/delete කළ විගස ප්‍රවේශය නැති කිරීමට
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(), // idle timeout සඳහා
    ip: text("ip"),
    userAgent: text("user_agent"),
    // false = මුරපදය නිවැරදියි, නමුත් 2-step code තවම ඇතුළත් කර නැත (මෙම session එකට ප්‍රවේශයක් නැත)
    mfaVerified: boolean("mfa_verified").notNull().default(true),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Email verification සහ Password reset tokens (hash කර ගබඩා කරයි)
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    type: tokenTypeEnum("type").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_type_idx").on(t.userId, t.type)],
);

// Email තහවුරු කිරීමේ ඉලක්කම් 6ක code එක (විනාඩි 10කින් කල් ඉකුත් වේ). පරිශීලකයෙකුට එකක් පමණි; ගබඩා කරන්නේ HMAC hash එක පමණි
export const emailOtps = pgTable("email_otps", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
});

// ICT Agent (ICT මිතුරා): සිසුවෙකුට එක් wallet එකක් (free credits). එක් පණිවිඩයකට credit 1යි
export const agentWallets = pgTable("agent_wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  granted: integer("granted").notNull().default(0), // මුළු ලැබුණු credits
  used: integer("used").notNull().default(0), // භාවිතා කළ credits
  conversationId: text("conversation_id").notNull(), // දැනට සිටින සංවාදය ("අලුත් සංවාදයක්" මගින් වෙනස් වේ)
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("agent_messages_user_conv_idx").on(t.userId, t.conversationId, t.createdAt)],
);

// ICT මිතුරාට යවන ඡායාරූප / PDF (පණිවිඩයකට සම්බන්ධයි; ගුරුවරයාට සංවාදය බැලීමේදී පෙන්වයි)
export const agentAttachments = pgTable(
  "agent_attachments",
  {
    id: id(),
    messageId: text("message_id")
      .notNull()
      .references(() => agentMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    data: bytea("data"), // object storage සක්‍රීය නම් NULL (storage_key හි ඇත)
    storageKey: text("storage_key"),
  },
  (t) => [index("agent_attachments_message_idx").on(t.messageId)],
);

// පාඩම් (ශ්‍රේණිය අනුව)
export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    title: text("title").notNull(),
    grade: integer("grade").notNull(),
    medium: mediumEnum("medium").notNull(),
    kind: lessonKindEnum("kind").notNull().default("LESSON"),
    order: integer("order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("lessons_grade_medium_order_idx").on(t.grade, t.medium, t.order),
    // එකම ශ්‍රේණියේ, එකම මාධ්‍යයේ, එකම වර්ගයේ එකම නමින් දෙකක් නොතිබීමට
    uniqueIndex("lessons_grade_medium_kind_title_uq").on(t.grade, t.medium, t.kind, t.title),
  ],
);

// සිසුවෙකු පාඩමක් / Tute එකක් විවෘත කළ වාර (ප්‍රගතිය සහ "නිෂ්ක්‍රීය සිසුන්" වාර්තාව සඳහා). එක් සිසුවෙකුට එක් පාඩමකට එක් පේළියක්
export const lessonViews = pgTable(
  "lesson_views",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    firstViewedAt: timestamp("first_viewed_at").notNull().defaultNow(),
    lastViewedAt: timestamp("last_viewed_at").notNull().defaultNow(),
    views: integer("views").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] }), index("lesson_views_lesson_idx").on(t.lessonId), index("lesson_views_last_idx").on(t.lastViewedAt)],
);

// Google Drive link සහිත සෑම content එකක්ම
export const resources = pgTable(
  "resources",
  {
    id: id(),
    title: text("title").notNull(),
    type: contentTypeEnum("type").notNull(),
    driveUrl: text("drive_url").notNull(),
    grade: integer("grade").notNull(),
    medium: mediumEnum("medium").notNull(),
    lessonId: text("lesson_id").references(() => lessons.id, {
      onDelete: "cascade",
    }),
    year: integer("year"), // Past paper වසර
    order: integer("order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("resources_grade_medium_type_idx").on(t.grade, t.medium, t.type),
    index("resources_lesson_idx").on(t.lessonId),
  ],
);

export const requestStatusEnum = pgEnum("request_status", ["PENDING", "APPROVED", "REJECTED"]);

// සිසුවා ඉල්ලන ශ්‍රේණිය / මාධ්‍යය / ආයතනය වෙනස් කිරීම් (Admin අනුමැතියෙන් පසු පමණක් ක්‍රියාත්මක වේ)
export const changeRequests = pgTable(
  "change_requests",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grade: integer("grade").notNull(),
    alYear: integer("al_year"),
    medium: mediumEnum("medium").notNull(),
    instituteId: text("institute_id").references(() => institutes.id, { onDelete: "set null" }),
    note: text("note"),
    status: requestStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    decidedAt: timestamp("decided_at"),
  },
  (t) => [
    index("change_requests_status_idx").on(t.status, t.createdAt),
    // එක් සිසුවෙකුට එකවර ඉල්ලීම් එකක් පමණක්
    uniqueIndex("change_requests_one_pending_uq").on(t.userId).where(sql`${t.status} = 'PENDING'`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    target: text("target"),
    targetId: text("target_id"), // ක්‍රියාව බලපෑ පරිශීලකයා (ඉතිහාසය බැලීමට)
    details: text("details"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    // tamper-evident chain: hash = HMAC(prevHash + පේළියේ අන්තර්ගතය). පරණ (chain පෙර) පේළි වල null
    seq: bigserial("seq", { mode: "number" }).notNull(),
    prevHash: text("prev_hash"),
    hash: text("hash"),
  },
  (t) => [
    uniqueIndex("audit_logs_seq_uq").on(t.seq),
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_target_idx").on(t.targetId),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);


// දැනුම්දීම්: සිදුවීම් වර්ගය + පරාමිති පමණක් ගබඩා කරයි (පෙළ පෙන්වන විට භාෂාවට අනුව සාදයි)
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, string | number | null>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    index("notifications_user_read_idx").on(t.userId, t.readAt),
  ],
);

/* ------------------------- පැවරුම් (Assignments) ------------------------- */

// Admin පවරන පැවරුම්: ශ්‍රේණිය + මාධ්‍යය (සහ අවශ්‍ය නම් එක් ආයතනයක්) අනුව
export const assignments = pgTable(
  "assignments",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    grade: integer("grade").notNull(),
    medium: mediumEnum("medium").notNull(),
    instituteId: text("institute_id").references(() => institutes.id, { onDelete: "set null" }), // null = සියලු ආයතන
    attachmentUrl: text("attachment_url"), // ප්‍රශ්න පත්‍රය (Google Drive link)
    dueAt: timestamp("due_at").notNull(),
    maxMarks: integer("max_marks"),
    isPublished: boolean("is_published").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("assignments_grade_medium_idx").on(t.grade, t.medium, t.dueAt)],
);

// සිසුවෙකුගේ පැවරුමක් සඳහා ඉදිරිපත් කිරීම (එක් සිසුවෙකුට එක පැවරුමකට එකක්)
export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note"),
    marks: integer("marks"),
    feedback: text("feedback"),
    gradedAt: timestamp("graded_at"),
    gradedBy: text("graded_by"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("submissions_assignment_student_uq").on(t.assignmentId, t.studentId), index("submissions_student_idx").on(t.studentId)],
);

// පරිශීලකයාගේ profile ඡායාරූපය (කුඩා, 256px JPEG; වෙනම table එකක - users query සැහැල්ලුව තබා ගැනීමට)
export const userAvatars = pgTable("user_avatars", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  data: bytea("data"), // object storage සක්‍රීය නම් NULL (storage_key හි ඇත)
    storageKey: text("storage_key"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const submissionFiles = pgTable(
  "submission_files",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256"), // උඩුගත කරන විට ගණනය කර, download කරන විට නැවත සත්‍යාපනය කරයි (integrity)
    data: bytea("data"), // object storage සක්‍රීය නම් NULL (storage_key හි ඇත)
    storageKey: text("storage_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("submission_files_submission_idx").on(t.submissionId)],
);

/* ----------------------------- Quiz (කාල සීමා සහිත) ----------------------------- */

export const quizzes = pgTable(
  "quizzes",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    grade: integer("grade").notNull(),
    medium: mediumEnum("medium").notNull(),
    instituteId: text("institute_id").references(() => institutes.id, { onDelete: "set null" }),
    opensAt: timestamp("opens_at").notNull(),
    closesAt: timestamp("closes_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    revealAnswers: boolean("reveal_answers").notNull().default(true), // Quiz වසන කාලයෙන් පසු නිවැරදි පිළිතුරු පෙන්වයි
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("quizzes_grade_medium_idx").on(t.grade, t.medium, t.opensAt)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: id(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    text: text("text").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    marks: integer("marks").notNull().default(1),
    explanation: text("explanation").notNull().default(""),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId, t.order)],
);

// සිසුවෙකුට Quiz එකක් එක් වරක් පමණක් (Admin ට නැවත සකස් කළ හැක)
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: id(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    deadlineAt: timestamp("deadline_at").notNull(), // min(ආරම්භය + කාලය, Quiz වසන වේලාව)
    submittedAt: timestamp("submitted_at"),
    score: integer("score"),
    total: integer("total"),
    answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [uniqueIndex("quiz_attempts_quiz_student_uq").on(t.quizId, t.studentId), index("quiz_attempts_student_idx").on(t.studentId)],
);

// Online පන්ති Zoom link: එක් කළ දින සිට පැය 24ක් පමණක් සිසුන්ට පෙනේ (expires_at ඉක්මවූ පසු සිසුන්ට නොපෙන්වයි)
export const classLinks = pgTable(
  "class_links",
  {
    id: id(),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    url: text("url").notNull(),
    grade: integer("grade").notNull(),
    medium: mediumEnum("medium").notNull(),
    instituteId: text("institute_id").references(() => institutes.id, { onDelete: "set null" }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("class_links_target_idx").on(t.grade, t.medium, t.expiresAt)],
);

// පන්ති පුවත්පත්‍රිකාව (Newsletter): Admin ලියා පළ කරයි; Dashboard එකේ අදාළ සිසුන්ට පෙනේ. grade/medium/institute හිස් (null) = සියල්ලන්ට
export const newsletters = pgTable(
  "newsletters",
  {
    id: id(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull(),
    grade: integer("grade"),
    medium: mediumEnum("medium"),
    instituteId: text("institute_id").references(() => institutes.id, { onDelete: "set null" }),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("newsletters_pub_idx").on(t.published, t.publishedAt)],
);

// Landing page එකේ පෙන්වන සිසුන්ගේ/දෙමාපියන්ගේ අදහස් (testimonials). Admin විසින් එක් කර, පෙන්වීම/සැඟවීම පාලනය කරයි
export const testimonials = pgTable(
  "testimonials",
  {
    id: id(),
    authorName: text("author_name").notNull(),
    authorInfo: text("author_info").notNull().default(""),
    quote: text("quote").notNull(),
    published: boolean("published").notNull().default(true),
    // APPROVED (Admin විසින් එක් කළ හෝ අනුමත කළ) | PENDING (සිසුවා එවූ, Admin අනුමැතිය බලාපොරොත්තුවෙන්) | REJECTED
    status: text("status").notNull().default("APPROVED"),
    // සිසුවෙක් එවූ අදහසක් නම් ඔහුගේ id (ගිණුම මැකූ විට අදහසද මැකේ: පෞද්ගලිකත්වය)
    submittedBy: text("submitted_by").references(() => users.id, { onDelete: "cascade" }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("testimonials_pub_idx").on(t.published, t.status, t.createdAt), index("testimonials_student_idx").on(t.submittedBy)],
);

// සංවාද මණ්ඩපය (Forum + Live chat). room: "general" | "g6".."g11" | "al" (සිසුන්ට තමන්ගේ ශ්‍රේණි කාමරය සහ "general" පමණි)
export const forumThreads = pgTable(
  "forum_threads",
  {
    id: id(),
    room: text("room").notNull(),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    replyCount: integer("reply_count").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("forum_threads_room_idx").on(t.room, t.hidden, t.pinned, t.lastActivityAt), index("forum_threads_author_idx").on(t.authorId)],
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: id(),
    threadId: text("thread_id").notNull().references(() => forumThreads.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("forum_posts_thread_idx").on(t.threadId, t.createdAt), index("forum_posts_author_idx").on(t.authorId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    room: text("room").notNull(),
    authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_room_idx").on(t.room, t.createdAt), index("chat_messages_author_idx").on(t.authorId)],
);

// Admin විසින් පණිවිඩ යැවීම නවත්වා ඇති සිසුන් (until = null: ස්ථිරව)
export const communityMutes = pgTable("community_mutes", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  mutedBy: text("muted_by"),
  reason: text("reason").notNull().default(""),
  until: timestamp("until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// සිසුන්ගේ වාර්තා (Report): kind = THREAD | POST | CHAT
export const communityReports = pgTable(
  "community_reports",
  {
    id: id(),
    kind: text("kind").notNull(),
    targetId: text("target_id").notNull(),
    reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("OPEN"), // OPEN | DONE
    handledBy: text("handled_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_reports_uniq").on(t.kind, t.targetId, t.reporterId), index("community_reports_status_idx").on(t.status, t.createdAt)],
);

// Rate limiting (serverless instance කිහිපයක් අතර බෙදාගැනීමට database එකේ ගබඩා කරයි)
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  institute: one(institutes, {
    fields: [users.instituteId],
    references: [institutes.id],
  }),
  sessions: many(sessions),
  tokens: many(authTokens),
}));

export const institutesRelations = relations(institutes, ({ many }) => ({
  users: many(users),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, { fields: [authTokens.userId], references: [users.id] }),
}));

export const lessonsRelations = relations(lessons, ({ many }) => ({
  resources: many(resources),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  lesson: one(lessons, {
    fields: [resources.lessonId],
    references: [lessons.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type Institute = typeof institutes.$inferSelect;
export type ContentType = (typeof contentTypeEnum.enumValues)[number];
export type Medium = (typeof mediumEnum.enumValues)[number];
export type AccountStatus = (typeof statusEnum.enumValues)[number];

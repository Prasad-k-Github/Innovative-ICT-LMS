import QRCode from "qrcode";
import { desc, eq } from "drizzle-orm";
import { revokeOtherSessionsAction, revokeSessionAction, beginMfaSetupAction } from "@/app/actions/security";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { DATE_LOCALE, type Lang } from "@/lib/i18n/core";
import type { T } from "@/lib/i18n/core";
import { SESSION_ADMIN_HOURS, SESSION_ADMIN_IDLE_MINUTES, SESSION_DAYS, SESSION_STUDENT_IDLE_DAYS } from "@/lib/constants";
import { describeDevice } from "@/lib/request-context";
import { decryptSecret } from "@/lib/secrets";
import { getCurrentSessionId } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { otpauthUri } from "@/lib/totp";
import { MfaConfirmForm, MfaDisableForm, MfaRegenForm } from "./mfa-forms";
import { btnPrimary } from "./ui";

const card = "space-y-4 card p-5 sm:p-6";

// Admin / Super Admin සඳහා 2-step verification (TOTP) කළමනාකරණය
export async function TwoStepCard({ userId, email, t }: { userId: string; email: string; t: T }) {
  const [u] = await db
    .select({ enc: users.mfaSecretEnc, enabledAt: users.mfaEnabledAt, recovery: users.mfaRecoveryHashes })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (u?.enabledAt) {
    return (
      <section className={card} data-testid="mfa-card" data-mfa="on">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 font-semibold">{t("2-step verification")}</h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{t("සක්‍රියයි")}</span>
        </div>
        <p className="text-sm text-muted">
          {t("Login වන විට මුරපදයට අමතරව Authenticator app එකේ code එකක් අවශ්‍යයි. ඉතිරි recovery codes: {n}", { n: u.recovery?.length ?? 0 })}
        </p>
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold text-primary">{t("නව recovery codes සාදන්න")}</summary>
          <div className="mt-3"><MfaRegenForm /></div>
        </details>
        <details className="rounded-xl border border-red-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("2-step අක්‍රිය කරන්න")}</summary>
          <div className="mt-3"><MfaDisableForm /></div>
        </details>
      </section>
    );
  }

  if (u?.enc) {
    const secret = decryptSecret(u.enc);
    const svg = await QRCode.toString(otpauthUri(email, secret), { type: "svg", margin: 1, width: 192, color: { dark: "#0b1633", light: "#ffffff" } });
    return (
      <section className={card} data-testid="mfa-card" data-mfa="setup">
        <h2 className="font-semibold">{t("2-step verification සකසන්න")}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>{t("Google Authenticator / Microsoft Authenticator / Authy app එක විවෘත කරන්න.")}</li>
          <li>{t("පහත QR code එක scan කරන්න (නැතහොත් රහස් යතුර ඇතුළත් කරන්න).")}</li>
          <li>{t("app එක පෙන්වන ඉලක්කම් 6ක code එක පහත ඇතුළත් කරන්න.")}</li>
        </ol>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="overflow-hidden rounded-xl border border-line bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code" />
          <div className="min-w-0 text-sm">
            <p className="text-muted">{t("රහස් යතුර")}</p>
            <p className="mt-1 break-all rounded-lg bg-surface px-3 py-2 font-mono tracking-wider" data-testid="mfa-secret">{secret}</p>
          </div>
        </div>
        <MfaConfirmForm />
      </section>
    );
  }

  return (
    <section className={card} data-testid="mfa-card" data-mfa="off">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{t("2-step verification")}</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{t("අක්‍රියයි")}</span>
      </div>
      <p className="text-sm text-muted">
        {t("Admin ගිණුම් ආරක්ෂා කිරීමට තදින් නිර්දේශ කරයි: මුරපදය හොරකම් වුවද code එක නැතිව login විය නොහැක.")}
      </p>
      <form>
        <button type="submit" formAction={beginMfaSetupAction} className={btnPrimary}>
          {t("සකසන්න")}
        </button>
      </form>
    </section>
  );
}

// පරිශීලකයාගේ සක්‍රිය sessions (devices) සහ ඒවා අවසන් කිරීම
export async function SessionsCard({ userId, t, lang }: { userId: string; t: T; lang: Lang }) {
  const [rows, currentId, [owner]] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.lastSeenAt)),
    getCurrentSessionId(),
    db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  const staff = owner?.role !== "STUDENT";
  const idleMs = staff ? SESSION_ADMIN_IDLE_MINUTES * 60_000 : SESSION_STUDENT_IDLE_DAYS * 86_400_000;
  const live = rows.filter((r) => r.mfaVerified && r.expiresAt.getTime() > nowMs() && nowMs() - r.lastSeenAt.getTime() <= idleMs);
  const when = (d: Date) => d.toLocaleString(DATE_LOCALE[lang], { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" });
  return (
    <section className={card} data-testid="sessions-card">
      <h2 className="font-semibold">{t("සක්‍රිය sessions")}</h2>
      <p className="text-sm text-muted">{t("ඔබගේ ගිණුමට login වී ඇති devices. ඔබ නොදන්නා ඒවා ඇත්නම් අවසන් කර මුරපදය වෙනස් කරන්න.")}</p>
      <p className="rounded-xl bg-primary-soft px-3 py-2 text-xs leading-relaxed text-primary-dark" data-testid="session-policy">
        {staff
          ? t("ආරක්ෂාව සඳහා: ක්‍රියාකාරී නොවී විනාඩි {idle}ක් ගියහොත් හෝ login වී පැය {max}ක් ගියහොත් session එක ස්වයංක්‍රීයව අවසන් වේ.", { idle: SESSION_ADMIN_IDLE_MINUTES, max: SESSION_ADMIN_HOURS })
          : t("ආරක්ෂාව සඳහා: ක්‍රියාකාරී නොවී දින {idle}ක් ගියහොත් හෝ login වී දින {max}ක් ගියහොත් session එක ස්වයංක්‍රීයව අවසන් වේ.", { idle: SESSION_STUDENT_IDLE_DAYS, max: SESSION_DAYS })}
      </p>
      <ul className="space-y-2">
        {live.map((s) => (
          <li key={s.id} data-session={s.id === currentId ? "current" : "other"} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {describeDevice(s.userAgent)}
                {s.id === currentId && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">{t("මෙම device එක")}</span>}
              </p>
              <p className="text-xs text-muted">
                {s.ip ?? "—"} · {t("අවසන් භාවිතය")}: {when(s.lastSeenAt)}
              </p>
              <p className="text-xs text-muted">
                {t("Login වූ වේලාව")}: {when(s.createdAt)} · {t("කල් ඉකුත් වන්නේ")}: {when(new Date(Math.min(s.expiresAt.getTime(), s.lastSeenAt.getTime() + idleMs)))}
              </p>
            </div>
            {s.id !== currentId && (
              <form>
                <button type="submit" formAction={revokeSessionAction.bind(null, s.id)} className="min-h-10 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50">
                  {t("අවසන් කරන්න")}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {live.length > 1 && (
        <form>
          <button type="submit" formAction={revokeOtherSessionsAction} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50">
            {t("අනෙක් සියලු devices වලින් logout වන්න")}
          </button>
        </form>
      )}
    </section>
  );
}

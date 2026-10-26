"use client";

import Link from "next/link";
import { useT } from "./i18n-provider";
import { Field, FieldError } from "./ui";

type Fe = Record<string, string[] | undefined> | undefined;
type Vals = Record<string, string> | undefined;

// දෙමාපිය/භාරකරුගේ සම්බන්ධතා (දුරකතනය අනිවාර්ය, Email විකල්ප). ලියාපදිංචි පෝරමයේ සහ පළමු login පියවරේ භාවිතා වේ
export function ParentContactFields({ fe, v }: { fe: Fe; v: Vals }) {
  const t = useT();
  return (
    <>
      <Field label={t("දෙමාපියන්ගේ දුරකතන අංකය (WhatsApp)")} name="parentPhone" type="tel" inputMode="tel" placeholder="07XXXXXXXX" defaultValue={v?.parentPhone} error={fe?.parentPhone} />
      <Field
        label={t("දෙමාපියන්ගේ Email ලිපිනය (විකල්ප)")}
        name="parentEmail"
        type="email"
        inputMode="email"
        required={false}
        defaultValue={v?.parentEmail}
        error={fe?.parentEmail}
        hint={t("Email ලිපිනයක් දුන්නොත් සතිපතා සාරාංශය Email මගින් ද ලැබේ.")}
      />
    </>
  );
}

const box = "flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5 text-sm leading-relaxed text-ink";
const cb = "mt-0.5 h-6 w-6 shrink-0 rounded border-line accent-primary";

// වෙන වෙනම ඉල්ලන එකඟත්වයන් දෙක: (1) පෞද්ගලිකත්ව ප්‍රතිපත්තිය, (2) සතිපතා ප්‍රගති සාරාංශය දෙමාපියන්ට දැනුම් දීම (පන්තියේ ක්‍රියාපටිපාටිය)
export function ConsentChecks({ fe, v }: { fe: Fe; v: Vals }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="consent" className={box}>
          <input id="consent" type="checkbox" name="consent" defaultChecked={v?.consent === "on"} aria-invalid={fe?.consent ? true : undefined} className={cb} />
          <span>
            {t("මම")}{" "}
            <Link href="/privacy" target="_blank" className="inline-block py-1 font-semibold text-primary underline underline-offset-2">
              {t("පෞද්ගලිකත්ව ප්‍රතිපත්තිය")}
            </Link>{" "}
            {t("කියවා එයට එකඟ වෙමි. මා වයස 18ට අඩු නම්, මගේ දෙමාපියන්ගේ/භාරකරුගේ අවසරය ලබාගෙන ඇත.")}
          </span>
        </label>
        <FieldError error={fe?.consent} />
      </div>
      <div>
        <label htmlFor="parentAck" className={box}>
          <input id="parentAck" type="checkbox" name="parentAck" defaultChecked={v?.parentAck === "on"} aria-invalid={fe?.parentAck ? true : undefined} className={cb} />
          <span>
            {t("මෙම පන්තියේ සිසුන්ගේ ප්‍රගති සාරාංශය (බැලූ පාඩම්, Quiz ලකුණු, පැවරුම්) සතිපතා දෙමාපියන්ට/භාරකරුවන්ට දැනුම් දෙන බව මම දනිමි; මගේ දෙමාපියන්ද එය දන්නා බව තහවුරු කරමි.")}
          </span>
        </label>
        <p className="mt-1 text-xs text-muted">{t("සාරාංශ Email සෑම එකකම ලැබීම නවත්වා ගැනීමට unsubscribe link එකක් ඇත. වැඩි විස්තර පෞද්ගලිකත්ව ප්‍රතිපත්තියේ.")}</p>
        <FieldError error={fe?.parentAck} />
      </div>
    </div>
  );
}

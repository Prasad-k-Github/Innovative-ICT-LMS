"use client";

import { useEffect, useRef, useState } from "react";
import { saveAnswerAction, submitQuizAction, uploadSubmissionAction } from "@/app/actions/student-work";
import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES } from "@/lib/constants";
import type { FormState } from "@/lib/validators";
import { useKeyedForm } from "./content-forms";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert, TextAreaField } from "./ui";

// පැවරුම් file උඩුගත කිරීමේ form එක
export function UploadForm({ assignmentId, remaining }: { assignmentId: string; remaining: number }) {
  const t = useT();
  const [state, formAction] = useKeyedForm(uploadSubmissionAction, {} as FormState);
  const [clientError, setClientError] = useState("");

  // ඉතා විශාල files server එකට යැවීමට පෙර browser එකේදීම පරීක්ෂා කරයි
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const total = files.reduce((s, f) => s + f.size, 0);
    if (files.length > remaining) setClientError(t("උපරිම files {n}ක් පමණක් එක් කළ හැක.", { n: remaining }));
    else if (total > UPLOAD_MAX_BYTES) setClientError(t("එකවර උඩුගත කරන files සම්පූර්ණයෙන් 4MB ට වඩා විශාලයි. කිහිප වතාවකින් උඩුගත කරන්න."));
    else setClientError("");
  }

  return (
    <form
      key={state.n ?? 0}
      action={formAction}
      className="space-y-3"
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem("files");
        const files = input instanceof HTMLInputElement ? Array.from(input.files ?? []) : [];
        if (files.length === 0) {
          e.preventDefault();
          setClientError(t("File එකක් තෝරන්න."));
        } else if (clientError) e.preventDefault();
      }}
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
      {clientError && <Alert kind="error">{clientError}</Alert>}
      <div>
        <label htmlFor="files" className="mb-1.5 block text-sm font-medium">
          {t("File තෝරන්න")}
        </label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          required
          onChange={onChange}
          className="block w-full rounded-xl border border-line bg-white p-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-semibold file:text-primary"
        />
        <p className="mt-1 text-xs text-muted">{t("PDF, ඡායාරූප, Word, PowerPoint, Excel හෝ ZIP · එකවර උපරිම 4MB")}</p>
      </div>
      <TextAreaField id="note" label={t("සටහනක් (අවශ්‍ය නම්)")} name="note" rows={2} />
      <SubmitButton pendingText="උඩුගත කරමින්...">{t("උඩුගත කරන්න")}</SubmitButton>
    </form>
  );
}

export type RunnerQuestion = { id: string; text: string; options: string[]; marks: number };

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Quiz එක කරන අතරතුර: ටයිමරය, පිළිතුරු ස්වයංක්‍රීයව සුරැකීම, කාලය ඉකුත් වූ විට ස්වයංක්‍රීයව ඉදිරිපත් කිරීම
export function QuizRunner({
  quizId,
  attemptId,
  questions,
  saved,
  secondsLeft,
}: {
  quizId: string;
  attemptId: string;
  questions: RunnerQuestion[];
  saved: Record<string, number>;
  secondsLeft: number;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  // server එකෙන් ලැබුණු ඉතිරි කාලය මත පදනම් වේ (පරිශීලකයාගේ ඔරලෝසුව මත රඳා නොපවතී)
  const endAt = useRef<number | null>(null);
  const [left, setLeft] = useState(secondsLeft * 1000);
  const [answered, setAnswered] = useState<Record<string, number>>(saved);
  const [saveFailed, setSaveFailed] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    endAt.current = Date.now() + secondsLeft * 1000;
    const tick = () => {
      const l = (endAt.current ?? 0) - Date.now();
      setLeft(l);
      if (l <= 0 && !submitted.current) {
        submitted.current = true;
        formRef.current?.requestSubmit();
      }
    };
    tick();
    const i = setInterval(tick, 500);
    return () => clearInterval(i);
  }, [secondsLeft]);

  async function pick(qid: string, idx: number) {
    setAnswered((a) => ({ ...a, [qid]: idx }));
    try {
      const r = await saveAnswerAction(attemptId, qid, idx);
      setSaveFailed(!r.ok);
    } catch {
      setSaveFailed(true);
    }
  }

  const low = left <= 60_000;
  const count = Object.keys(answered).length;
  return (
    <form
      ref={formRef}
      action={submitQuizAction.bind(null, quizId)}
      onSubmit={() => {
        submitted.current = true;
      }}
      className="space-y-5"
    >
      <div className={`sticky top-[6.5rem] z-[5] flex items-center justify-between rounded-xl border px-4 py-2.5 shadow-sm ${low ? "border-red-300 bg-accent-soft" : "border-line bg-white"}`}>
        <span className="text-sm text-muted" data-testid="answered">
          {t("පිළිතුරු {n}/{m}", { n: count, m: questions.length })}
        </span>
        <span data-testid="timer" className={`font-mono text-lg font-bold ${low ? "text-red-700" : "text-navy"}`} aria-live="off">
          ⏱ {fmt(left)}
        </span>
      </div>
      {saveFailed && <Alert kind="warning">{t("පිළිතුර සුරැකීමට නොහැකි විය. ඔබගේ අන්තර්ජාල සම්බන්ධතාවය පරීක්ෂා කරන්න. ඉදිරිපත් කරන විට පිළිතුරු නැවත යවයි.")}</Alert>}

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="space-y-3 card p-4" data-q={q.id}>
            <p className="font-medium leading-relaxed">
              {i + 1}. {q.text} <span className="text-xs font-normal text-muted">({t("ලකුණු {n}", { n: q.marks })})</span>
            </p>
            <div className="space-y-2">
              {q.options.map((o, oi) => (
                <label
                  key={oi}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${answered[q.id] === oi ? "border-primary bg-primary-soft" : "border-line hover:bg-slate-50"}`}
                >
                  <input type="radio" name={`q_${q.id}`} value={oi} checked={answered[q.id] === oi} onChange={() => pick(q.id, oi)} className="h-5 w-5 shrink-0" />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <SubmitButton pendingText="ඉදිරිපත් කරමින්...">{t("Quiz එක ඉදිරිපත් කරන්න")}</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { sendParentSummariesAction, type SendSummariesState } from "@/app/actions/admin";
import { useT } from "./i18n-provider";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

// Admin: එකඟ වූ දෙමාපියන්ට Email සාරාංශ දැන්ම යවන්න
export function SendSummariesButton({ eligible }: { eligible: number }) {
  const t = useT();
  const [state, action] = useActionState(async () => sendParentSummariesAction(), {} as SendSummariesState);
  return (
    <form action={action} className="space-y-3" data-testid="send-summaries">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.result && (
        <Alert kind={state.result.failed ? "warning" : "success"}>
          {t("Email සාරාංශ {sent}ක් යැවිණි, අසාර්ථක {failed}ක්.", { sent: state.result.sent, failed: state.result.failed })}
        </Alert>
      )}
      <SubmitButton pendingText="යවමින්...">{t("Email සාරාංශ දැන් යවන්න ({n})", { n: eligible })}</SubmitButton>
    </form>
  );
}

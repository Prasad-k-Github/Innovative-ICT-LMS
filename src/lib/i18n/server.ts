import "server-only";
import { cookies } from "next/headers";
import type { FormState } from "../validators";
import { LANG_COOKIE, makeT, parseLang, type Lang, type T } from "./core";

export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT(): Promise<T> {
  return makeT(await getLang());
}

// Server action ප්‍රතිචාරයක ඇති සියලු පණිවිඩ (error, message, field errors) පරිවර්තනය කරයි
export async function localized(state: FormState): Promise<FormState> {
  const t = await getT();
  const fieldErrors = state.fieldErrors
    ? Object.fromEntries(
        Object.entries(state.fieldErrors).map(([k, v]) => [k, v?.map((m) => t(m))]),
      )
    : undefined;
  return {
    ...state,
    error: state.error ? t(state.error) : undefined,
    message: state.message ? t(state.message) : undefined,
    fieldErrors,
  };
}

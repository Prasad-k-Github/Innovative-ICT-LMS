"use client";

import { useState, type FocusEvent, type FormEvent } from "react";
import type { ZodType } from "zod";
import { useT } from "./i18n-provider";

type Errors = Record<string, string[] | undefined>;

/**
 * Client-side validation: server එකේ භාවිතා වන Zod schema එකම browser එකේද ධාවනය කරයි.
 * - Submit කරන විට: වැරදි ඇත්නම් server එකට නොයවා ක්ෂේත්‍ර අසල පෙන්වයි සහ පළමු වැරදි ක්ෂේත්‍රයට focus කරයි
 * - Field එකකින් බැහැර වන විට (blur): ඒ ක්ෂේත්‍රය පරීක්ෂා කරයි
 * - වැරදි පෙන්වා ඇති ක්ෂේත්‍රයක් ටයිප් කරන විට: නිවැරදි වූ විගස වැරද්ද ඉවත් කරයි
 * Server validation සැමවිටම පවතී (client එක මග හැරිය හැකි නිසා); server දෝෂ ද එම `fe` හි ඒකාබද්ධව පෙන්වයි.
 */
export function useFormValidation(
  schema: ZodType,
  serverErrors?: Errors,
  opts?: { collect?: (fd: FormData) => unknown; extraKeys?: string[] },
) {
  const t = useT();
  const [local, setLocal] = useState<Errors>({});
  // server දෝෂ පෙන්වූ පසු පරිශීලකයා සංස්කරණය කළ ක්ෂේත්‍ර (ඊළඟ server ප්‍රතිචාරයේදී යළි සකසයි)
  const [edited, setEdited] = useState<{ src: Errors | undefined; names: string[] }>({ src: serverErrors, names: [] });

  const validate = (form: HTMLFormElement): Errors => {
    const fd = new FormData(form);
    for (const k of Array.from(fd.keys())) if (k.startsWith("$")) fd.delete(k);
    const data = opts?.collect ? opts.collect(fd) : Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string"));
    const res = schema.safeParse(data);
    if (res.success) return {};
    const out: Errors = {};
    for (const issue of res.error.issues) {
      const key = String(issue.path[0] ?? "");
      // form එකේ නැති ක්ෂේත්‍ර (hidden/server-only) ගැන පෙන්වන්නේ නැත
      if (!key || (!form.elements.namedItem(key) && !opts?.extraKeys?.includes(key)) || out[key]) continue;
      out[key] = [t(issue.message)];
    }
    return out;
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const errs = validate(form);
    setLocal(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      e.preventDefault(); // server action එක ක්‍රියාත්මක නොවේ
      const el = form.elements.namedItem(first);
      if (el instanceof HTMLElement) el.focus();
      else if (el instanceof RadioNodeList && el[0] instanceof HTMLElement) el[0].focus();
    }
  };

  const nameOf = (e: { target: EventTarget }) => (e.target instanceof HTMLElement && "name" in e.target ? String((e.target as HTMLInputElement).name) : "");

  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    const name = nameOf(e);
    if (!name) return;
    const el = e.currentTarget.elements.namedItem(name);
    // හිස් ක්ෂේත්‍රයක් හරහා Tab කිරීමෙන් පමණක් "අවශ්‍යයි" දෝෂ නොපෙන්වයි: අගයක් ඇති හෝ කලින් වැරදි පෙන්වූ ක්ෂේත්‍ර පමණක්
    const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el.value : "x";
    if (!value && !local[name]) return;
    const errs = validate(e.currentTarget);
    setLocal((p) => ({ ...p, [name]: errs[name] }));
  };

  const onInput = (e: FormEvent<HTMLFormElement>) => {
    const name = nameOf(e);
    if (!name) return;
    if (edited.src === serverErrors) {
      if (!edited.names.includes(name)) setEdited({ src: serverErrors, names: [...edited.names, name] });
    } else {
      setEdited({ src: serverErrors, names: [name] });
    }
    if (local[name]) {
      const errs = validate(e.currentTarget);
      setLocal((p) => ({ ...p, [name]: errs[name] }));
    }
  };

  const editedNames = edited.src === serverErrors ? edited.names : [];
  const fe: Errors = { ...local };
  if (serverErrors) {
    for (const [k, v] of Object.entries(serverErrors)) {
      if (!fe[k]?.length && !editedNames.includes(k)) fe[k] = v;
    }
  }

  return { fe, formProps: { onSubmit, onBlur, onInput, noValidate: true as const } };
}

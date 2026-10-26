// CSV (Excel හි Sinhala නිවැරදිව පෙනීමට UTF-8 BOM සමඟ) සහ CSV injection වැළැක්වීම
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // =, +, -, @ වලින් ආරම්භ වන අගයන් ඉදිරියට ' යොදයි (Excel formula ලෙස ධාවනය වීම වළක්වයි)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvResponse(header: string[], rows: unknown[][], filename: string): Response {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const csvDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");

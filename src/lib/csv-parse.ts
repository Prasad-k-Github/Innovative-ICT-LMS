// සරල CSV කියවන්නා (උද්ධරණ, කොමා/semicolon/tab, නව පේළි සහිත අගයන්, UTF-8 BOM සහාය)
export function parseCsv(input: string): string[][] {
  let text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!text.endsWith("\n")) text += "\n";
  // delimiter එක පළමු පේළියෙන් හඳුනා ගනී
  const first = text.slice(0, text.indexOf("\n"));
  const delim = [",", ";", "\t"].map((d) => ({ d, n: first.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row.map((x) => x.trim()));
      row = [];
    } else cur += c;
  }
  return rows;
}

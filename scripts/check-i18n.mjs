// සිංහල පාඨ සියල්ලටම English පරිවර්තන (src/lib/i18n/en.ts) තිබේදැයි පරීක්ෂා කරයි.
// භාවිතය: node scripts/check-i18n.mjs [--list]  (අඩු පරිවර්තන තිබේ නම් exit code 1)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SI = /[඀-෿]/;
// mail.ts: email සිංහල සහ English දෙකෙන්ම යවන නිසා වෙනම පරිවර්තනයක් අවශ්‍ය නැත
// privacy-content.ts: සිංහල + English දෙකම එහිම ඇත ({ si, en })
const SKIP = new Set(["src/lib/i18n/en.ts", "src/db/curriculum.ts", "src/lib/mail.ts", "src/lib/agent-prompt.ts", "src/lib/privacy-content.ts"]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

const enSrc = readFileSync("src/lib/i18n/en.ts", "utf8");
const enKeys = new Set();
for (const m of enSrc.matchAll(/^\s*"((?:[^"\\\n]|\\.)*)":/gm)) enKeys.add(JSON.parse(`"${m[1]}"`));

const used = new Set();
const problems = [];
for (const file of walk("src")) {
  if (SKIP.has(file)) continue;
  let src = readFileSync(file, "utf8");
  src = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
  const strip = (re, fn) => {
    src = src.replace(re, (m, raw) => {
      if (SI.test(raw)) fn(raw, m);
      return '""';
    });
  };
  strip(/"((?:[^"\\\n]|\\.)*)"/g, (raw) => {
    try { used.add(JSON.parse(`"${raw}"`)); } catch { used.add(raw); }
  });
  strip(/`((?:[^`\\]|\\.)*)`/g, (raw) => {
    if (raw.includes("${")) problems.push(`${file}: template literal with Sinhala: ${raw.slice(0, 50)}`);
    else used.add(raw);
  });
  src.split("\n").forEach((line, i) => {
    if (SI.test(line)) problems.push(`${file}:${i + 1}: raw Sinhala outside t(): ${line.trim().slice(0, 70)}`);
  });
}

const missing = [...used].filter((k) => !enKeys.has(k));
if (process.argv.includes("--list")) for (const k of missing) console.log(JSON.stringify(k));
console.log(`\nkeys used: ${used.size}, in en.ts: ${enKeys.size}, missing: ${missing.length}, problems: ${problems.length}`);
problems.forEach((p) => console.log("PROBLEM", p));
process.exit(missing.length || problems.length ? 1 : 0);

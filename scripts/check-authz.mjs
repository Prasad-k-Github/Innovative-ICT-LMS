// "use server" files හි සෑම action එකක්ම (wrappers හැර) පරිශීලකයාගේ භූමිකාව පරීක්ෂා කරනවාදැයි (require*) පරීක්ෂා කරයි.
// Server Actions public endpoints නිසා මෙය අත්‍යවශ්‍යයි. භාවිතය: node scripts/check-authz.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Login නොකළ අයටත් විවෘත විය යුතු actions (ඒවා rate-limit / token මගින් ආරක්ෂා වේ)
const PUBLIC = new Set(["auth.ts", "lang.ts", "parent.ts"]); // parent.ts: දෙමාපියන්ගේ unsubscribe (HMAC අත්සන + rate-limit මගින් ආරක්ෂිත)
const dir = "src/app/actions";
const problems = [];
let checked = 0;

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".ts") || PUBLIC.has(file)) continue;
  const src = readFileSync(join(dir, file), "utf8");
  if (!/^"use server"/.test(src)) continue;
  // function එකක් ආරම්භ වන තැන් වලින් බෙදයි
  const parts = src.split(/\n(?=(?:export )?async function )/);
  for (const part of parts) {
    const m = /^(?:export )?async function (\w+)/.exec(part);
    if (!m) continue;
    const body = part;
    const isWrapper = /return localized\(await \w+Impl\(/.test(body) && body.length < 400;
    if (isWrapper) continue;
    const isHelper = !/^export /.test(body) && !/Impl$/.test(m[1]); // ඇතුළත helper (action නොවේ)
    if (isHelper) continue;
    checked++;
    if (!/\brequire(Admin|AdminSetup|SuperAdmin|Student|User)\(/.test(body)) problems.push(`${file}: ${m[1]}() භූමිකා පරීක්ෂාවක් නැත`);
  }
}
console.log(`actions checked: ${checked}, problems: ${problems.length}`);
for (const p of problems) console.log("  ✗ " + p);
process.exit(problems.length ? 1 : 0);
